import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function hydrateDeckRowsWithStats(
  ctx: any,
  userId: any,
  links: Array<{
    wordId: any;
    position: number;
    language?: string;
    target?: string;
    reading?: string;
    romanization?: string;
    meaning?: string;
    example?: string;
    audioUrl?: string;
    shapeStrength?: number;
    typingStrength?: number;
    listeningStrength?: number;
    shapeDueAt?: number;
    typingDueAt?: number;
    listeningDueAt?: number;
    lastPracticedAt?: number;
  }>,
) {
  const rows = await Promise.all(
    links.map(async (link) => {
      const word =
        link.target !== undefined && link.meaning !== undefined && link.language !== undefined
          ? {
              _id: link.wordId,
              userId,
              language: link.language,
              target: link.target,
              reading: link.reading,
              romanization: link.romanization,
              meaning: link.meaning,
              example: link.example,
              audioUrl: link.audioUrl,
              tags: [],
            }
          : await ctx.db.get(link.wordId);
      if (!word) return null;
      const stat =
        link.shapeStrength !== undefined &&
        link.typingStrength !== undefined &&
        link.listeningStrength !== undefined &&
        link.shapeDueAt !== undefined &&
        link.typingDueAt !== undefined &&
        link.listeningDueAt !== undefined
          ? {
              shapeStrength: link.shapeStrength,
              typingStrength: link.typingStrength,
              listeningStrength: link.listeningStrength,
              shapeDueAt: link.shapeDueAt,
              typingDueAt: link.typingDueAt,
              listeningDueAt: link.listeningDueAt,
              lastPracticedAt: link.lastPracticedAt,
            }
          : await ctx.db
              .query("word_channel_stats")
              .withIndex("by_user_word", (q) => q.eq("userId", userId).eq("wordId", link.wordId))
              .first();
      return { word, stat, position: link.position };
    }),
  );

  return rows.filter((row): row is NonNullable<typeof row> => !!row);
}

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
      attemptedWordIds: [],
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

export const getDeckPracticeProgress = query({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deck_practice_progress")
      .withIndex("by_user_deck", (q) => q.eq("userId", args.userId).eq("deckId", args.deckId))
      .first();
  },
});

export const upsertDeckPracticeProgress = mutation({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
    nextPosition: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("deck_practice_progress")
      .withIndex("by_user_deck", (q) => q.eq("userId", args.userId).eq("deckId", args.deckId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        nextPosition: args.nextPosition,
        updatedAt: args.updatedAt,
      });
      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("deck_practice_progress", {
      userId: args.userId,
      deckId: args.deckId,
      nextPosition: args.nextPosition,
      updatedAt: args.updatedAt,
    });

    return await ctx.db.get(id);
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
    const attemptedWordIds = session.attemptedWordIds ?? [];
    const hasWord = attemptedWordIds.some((id) => `${id}` === `${args.wordId}`);
    await ctx.db.patch(args.sessionId, {
      cardsCompleted,
      attemptedWordIds: hasWord ? attemptedWordIds : [...attemptedWordIds, args.wordId],
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

export const syncDeckWordStatsSnapshot = mutation({
  args: {
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
    const links = await ctx.db
      .query("deck_words")
      .withIndex("by_word", (q) => q.eq("wordId", args.wordId))
      .collect();

    await Promise.all(
      links.map((link) =>
        ctx.db.patch(link._id, {
          shapeStrength: args.shapeStrength,
          typingStrength: args.typingStrength,
          listeningStrength: args.listeningStrength,
          shapeDueAt: args.shapeDueAt,
          typingDueAt: args.typingDueAt,
          listeningDueAt: args.listeningDueAt,
          lastPracticedAt: args.lastPracticedAt,
        }),
      ),
    );

    return { updated: links.length };
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

    return {
      page: await hydrateDeckRowsWithStats(ctx, args.userId, result.page),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const listDeckWordsWithStatsFromPosition = query({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
    startPosition: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const forward = await ctx.db
      .query("deck_words")
      .withIndex("by_deck_position", (q) => q.eq("deckId", args.deckId).gte("position", args.startPosition))
      .order("asc")
      .take(args.limit);

    let links = forward;
    if (links.length < args.limit) {
      const wrapped = await ctx.db
        .query("deck_words")
        .withIndex("by_deck_position", (q) => q.eq("deckId", args.deckId).lt("position", args.startPosition))
        .order("asc")
        .take(args.limit - links.length);
      links = [...links, ...wrapped];
    }

    const page = await hydrateDeckRowsWithStats(ctx, args.userId, links);
    const lastPosition = links[links.length - 1]?.position;

    return {
      page,
      nextStartPosition: lastPosition === undefined ? args.startPosition : lastPosition + 1,
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
