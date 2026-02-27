import { query } from "./_generated/server";
import { v } from "convex/values";

function dateString(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

const DASHBOARD_SCAN_LIMIT = 1800;

export const summary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const today = dateString(Date.now());

    const now = Date.now();

    const words = await ctx.db
      .query("words")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(DASHBOARD_SCAN_LIMIT + 1);

    const stats = await ctx.db
      .query("word_channel_stats")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(DASHBOARD_SCAN_LIMIT + 1);

    const wordSummary = {
      count: Math.min(words.length, DASHBOARD_SCAN_LIMIT),
      capped: words.length > DASHBOARD_SCAN_LIMIT,
    };

    const dueSummary = {
      due: stats
        .slice(0, DASHBOARD_SCAN_LIMIT)
        .filter((s) => Math.min(s.shapeDueAt, s.typingDueAt, s.listeningDueAt) <= now).length,
      capped: stats.length > DASHBOARD_SCAN_LIMIT,
    };

    const [sessions, completedToday] = await Promise.all([
      ctx.db
        .query("practice_sessions")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(50),
      ctx.db
        .query("daily_stats")
        .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", today))
        .first(),
    ]);

    return {
      totalWordsLearned: wordSummary.count,
      wordsDueToday: dueSummary.due,
      totalWordsLearnedCapped: wordSummary.capped,
      wordsDueTodayCapped: dueSummary.capped,
      learningStreak: completedToday?.streakCount ?? 0,
      sessionTimeSeconds: completedToday?.secondsSpent ?? 0,
      recentSessions: sessions
        .filter((s) => !!s.finishedAt)
        .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
        .slice(0, 7)
        .map((s) => ({
          sessionId: s._id,
          cardsCompleted: s.cardsCompleted,
          startedAt: s.startedAt,
          finishedAt: s.finishedAt,
        })),
    };
  },
});
