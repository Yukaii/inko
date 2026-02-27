import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const startSession = mutation({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("practice_sessions", {
      userId: args.userId,
      deckId: args.deckId,
      startedAt: Date.now(),
      cardsCompleted: 0,
    });

    return await ctx.db.get(sessionId);
  },
});

export const finishSession = mutation({
  args: {
    sessionId: v.id("practice_sessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    await ctx.db.patch(args.sessionId, {
      finishedAt: Date.now(),
    });

    return await ctx.db.get(args.sessionId);
  },
});

export const getSessionById = query({
  args: {
    sessionId: v.id("practice_sessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

export const addAttempt = mutation({
  args: {
    sessionId: v.id("practice_sessions"),
    wordId: v.id("words"),
    shapeScore: v.number(),
    typingScore: v.number(),
    listeningScore: v.number(),
    typingMs: v.number(),
    maxCards: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return { ok: false, capped: true, cardsCompleted: 0 };
    }

    if (session.cardsCompleted >= args.maxCards) {
      return { ok: false, capped: true, cardsCompleted: session.cardsCompleted };
    }

    await ctx.db.insert("practice_attempts", {
      sessionId: args.sessionId,
      wordId: args.wordId,
      shapeScore: args.shapeScore,
      typingScore: args.typingScore,
      listeningScore: args.listeningScore,
      typingMs: args.typingMs,
      submittedAt: Date.now(),
    });

    const cardsCompleted = session.cardsCompleted + 1;
    await ctx.db.patch(args.sessionId, {
      cardsCompleted,
    });

    return { ok: true, capped: false, cardsCompleted };
  },
});

export const listAttemptsBySession = query({
  args: {
    sessionId: v.id("practice_sessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("practice_attempts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const getWordStats = query({
  args: {
    userId: v.id("users"),
    wordId: v.id("words"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("word_channel_stats")
      .withIndex("by_user_word", (q) => q.eq("userId", args.userId).eq("wordId", args.wordId))
      .first();
  },
});

export const upsertWordStats = mutation({
  args: {
    userId: v.id("users"),
    wordId: v.id("words"),
    shapeStrength: v.number(),
    typingStrength: v.number(),
    listeningStrength: v.number(),
    shapeDueAt: v.number(),
    typingDueAt: v.number(),
    listeningDueAt: v.number(),
    lastPracticedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("word_channel_stats")
      .withIndex("by_user_word", (q) => q.eq("userId", args.userId).eq("wordId", args.wordId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        shapeStrength: args.shapeStrength,
        typingStrength: args.typingStrength,
        listeningStrength: args.listeningStrength,
        shapeDueAt: args.shapeDueAt,
        typingDueAt: args.typingDueAt,
        listeningDueAt: args.listeningDueAt,
        lastPracticedAt: args.lastPracticedAt,
      });

      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("word_channel_stats", {
      userId: args.userId,
      wordId: args.wordId,
      shapeStrength: args.shapeStrength,
      typingStrength: args.typingStrength,
      listeningStrength: args.listeningStrength,
      shapeDueAt: args.shapeDueAt,
      typingDueAt: args.typingDueAt,
      listeningDueAt: args.listeningDueAt,
      lastPracticedAt: args.lastPracticedAt,
    });

    return await ctx.db.get(id);
  },
});

export const listDeckWordsWithStats = query({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("deck_words")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    const rows = await Promise.all(
      links.map(async (link) => {
        const word = await ctx.db.get(link.wordId);
        if (!word) return null;
        const stat = await ctx.db
          .query("word_channel_stats")
          .withIndex("by_user_word", (q) => q.eq("userId", args.userId).eq("wordId", link.wordId))
          .first();
        return { word, stat };
      }),
    );

    return rows.filter((row): row is NonNullable<typeof row> => !!row);
  },
});

export const listDeckWordsWithStatsPage = query({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("deck_words")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .order("asc")
      .paginate({
        cursor: args.cursor,
        numItems: args.limit,
      });

    const rows = await Promise.all(
      result.page.map(async (link) => {
        const word = await ctx.db.get(link.wordId);
        if (!word) return null;
        const stat = await ctx.db
          .query("word_channel_stats")
          .withIndex("by_user_word", (q) => q.eq("userId", args.userId).eq("wordId", link.wordId))
          .first();
        return { word, stat };
      }),
    );

    return {
      page: rows.filter((row): row is NonNullable<typeof row> => !!row),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

function dateKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function previousDateKey(ts: number): string {
  const date = new Date(ts);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export const upsertDailyStats = mutation({
  args: {
    userId: v.id("users"),
    cardsCompletedDelta: v.number(),
    secondsSpentDelta: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const date = dateKey(args.now);
    const current = await ctx.db
      .query("daily_stats")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId).eq("date", date))
      .first();

    if (current) {
      await ctx.db.patch(current._id, {
        wordsCompleted: current.wordsCompleted + args.cardsCompletedDelta,
        secondsSpent: current.secondsSpent + args.secondsSpentDelta,
      });
      return await ctx.db.get(current._id);
    }

    const previous = await ctx.db
      .query("daily_stats")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).eq("date", previousDateKey(args.now)),
      )
      .first();

    const streakCount = (previous?.streakCount ?? 0) + 1;

    const id = await ctx.db.insert("daily_stats", {
      userId: args.userId,
      date,
      wordsCompleted: args.cardsCompletedDelta,
      secondsSpent: args.secondsSpentDelta,
      streakCount,
    });

    return await ctx.db.get(id);
  },
});
