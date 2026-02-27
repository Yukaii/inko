import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

function dateString(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

const DASHBOARD_SCAN_LIMIT = 1800;

async function loadDashboardStats(ctx: QueryCtx, userId: Id<"users">) {
  const now = Date.now();
  const today = dateString(now);

  const [decks, dueByShape, dueByTyping, dueByListening, completedToday] = await Promise.all([
    ctx.db
      .query("decks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("word_channel_stats")
      .withIndex("by_user_shape_due", (q) => q.eq("userId", userId).lte("shapeDueAt", now))
      .take(DASHBOARD_SCAN_LIMIT + 1),
    ctx.db
      .query("word_channel_stats")
      .withIndex("by_user_typing_due", (q) => q.eq("userId", userId).lte("typingDueAt", now))
      .take(DASHBOARD_SCAN_LIMIT + 1),
    ctx.db
      .query("word_channel_stats")
      .withIndex("by_user_listening_due", (q) => q.eq("userId", userId).lte("listeningDueAt", now))
      .take(DASHBOARD_SCAN_LIMIT + 1),
    ctx.db
      .query("daily_stats")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", today))
      .first(),
  ]);

  const dueWordIds = new Set<string>();
  let wordsDueTodayCapped = false;

  const collectDue = (items: Array<{ wordId: Id<"words"> }>) => {
    if (items.length > DASHBOARD_SCAN_LIMIT) wordsDueTodayCapped = true;
    for (const item of items) {
      dueWordIds.add(item.wordId);
      if (dueWordIds.size > DASHBOARD_SCAN_LIMIT) {
        wordsDueTodayCapped = true;
        break;
      }
    }
  };

  collectDue(dueByShape);
  collectDue(dueByTyping);
  collectDue(dueByListening);

  const knownWordCount = decks.reduce((sum, deck) => sum + (deck.wordCount ?? 0), 0);
  const hasMissingWordCount = decks.some((deck) => deck.wordCount === undefined);

  return {
    totalWordsLearned: knownWordCount,
    totalWordsLearnedCapped: hasMissingWordCount,
    wordsDueToday: Math.min(dueWordIds.size, DASHBOARD_SCAN_LIMIT),
    wordsDueTodayCapped,
    learningStreak: completedToday?.streakCount ?? 0,
    sessionTimeSeconds: completedToday?.secondsSpent ?? 0,
  };
}

async function loadRecentSessions(ctx: QueryCtx, userId: Id<"users">) {
  const sessions = await ctx.db
    .query("practice_sessions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(50);

  return sessions
    .filter((s) => !!s.finishedAt)
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    .slice(0, 7)
    .map((s) => ({
      sessionId: s._id,
      cardsCompleted: s.cardsCompleted,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
    }));
}

export const summaryStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await loadDashboardStats(ctx, args.userId);
  },
});

export const recentSessions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return {
      recentSessions: await loadRecentSessions(ctx, args.userId),
    };
  },
});

export const summary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const [stats, recent] = await Promise.all([
      loadDashboardStats(ctx, args.userId),
      loadRecentSessions(ctx, args.userId),
    ]);

    return {
      ...stats,
      recentSessions: recent,
    };
  },
});
