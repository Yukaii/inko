import { query } from "./_generated/server";
import { v } from "convex/values";

function dateString(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export const summary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const today = dateString(Date.now());

    const [words, stats, sessions, completedToday] = await Promise.all([
      ctx.db
        .query("words")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect(),
      ctx.db
        .query("word_channel_stats")
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .collect(),
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

    const now = Date.now();
    const dueToday = stats.filter((s) => Math.min(s.shapeDueAt, s.typingDueAt, s.listeningDueAt) <= now).length;

    return {
      totalWordsLearned: words.length,
      wordsDueToday: dueToday,
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
