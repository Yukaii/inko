import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function defaultLinkStats(now: number) {
  return {
    shapeStrength: 50,
    typingStrength: 50,
    listeningStrength: 50,
    shapeDueAt: now,
    typingDueAt: now,
    listeningDueAt: now,
  };
}

function deriveQueueFields(stats: {
  shapeStrength: number;
  typingStrength: number;
  listeningStrength: number;
  shapeDueAt: number;
  typingDueAt: number;
  listeningDueAt: number;
}) {
  return {
    weakestStrength: Math.min(stats.shapeStrength, stats.typingStrength, stats.listeningStrength),
    nextDueAt: Math.min(stats.shapeDueAt, stats.typingDueAt, stats.listeningDueAt),
  };
}

async function getDeckWordSnapshotPatch(ctx: any, link: any) {
  const patch: Record<string, unknown> = {};

  if (link.language === undefined || link.target === undefined || link.meaning === undefined) {
    const word = await ctx.db.get(link.wordId);
    if (!word) return null;
    patch.language = word.language;
    patch.target = word.target;
    patch.reading = word.reading;
    patch.romanization = word.romanization;
    patch.meaning = word.meaning;
    patch.example = word.example;
    patch.audioUrl = word.audioUrl;
  }

  if (
    link.shapeStrength === undefined ||
    link.typingStrength === undefined ||
    link.listeningStrength === undefined ||
    link.shapeDueAt === undefined ||
    link.typingDueAt === undefined ||
    link.listeningDueAt === undefined
  ) {
    const deck = await ctx.db.get(link.deckId);
    if (!deck) return null;
    const stat = await ctx.db
      .query("word_channel_stats")
      .withIndex("by_user_word", (q: any) => q.eq("userId", deck.userId).eq("wordId", link.wordId))
      .first();

    if (stat) {
      patch.shapeStrength = stat.shapeStrength;
      patch.typingStrength = stat.typingStrength;
      patch.listeningStrength = stat.listeningStrength;
      patch.shapeDueAt = stat.shapeDueAt;
      patch.typingDueAt = stat.typingDueAt;
      patch.listeningDueAt = stat.listeningDueAt;
      patch.lastPracticedAt = stat.lastPracticedAt;
    } else {
      Object.assign(patch, defaultLinkStats(Date.now()));
    }
  }

  patch.snapshotReady = true;
  return patch;
}

const languageValidator = v.union(
  v.literal("ja"),
  v.literal("ko"),
  v.literal("zh"),
  v.literal("es"),
  v.literal("fr"),
  v.literal("de"),
  v.literal("it"),
  v.literal("pt"),
  v.literal("ru"),
  v.literal("ar"),
  v.literal("hi"),
  v.literal("th"),
);

const createWordFields = {
  target: v.string(),
  reading: v.optional(v.string()),
  romanization: v.optional(v.string()),
  meaning: v.string(),
  example: v.optional(v.string()),
  audioUrl: v.optional(v.string()),
  tags: v.array(v.string()),
};

export const listDecks = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("decks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const createDeck = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    language: languageValidator,
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("decks", {
      userId: args.userId,
      name: args.name,
      language: args.language,
      archived: false,
      wordCount: 0,
      createdAt: Date.now(),
    });

    return await ctx.db.get(id);
  },
});

export const getDeckById = query({
  args: { deckId: v.id("decks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.deckId);
  },
});

export const updateDeck = mutation({
  args: {
    deckId: v.id("decks"),
    name: v.optional(v.string()),
    language: v.optional(languageValidator),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db.get(args.deckId);
    if (!deck) return null;

    await ctx.db.patch(args.deckId, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.language !== undefined ? { language: args.language } : {}),
      ...(args.archived !== undefined ? { archived: args.archived } : {}),
    });

    return await ctx.db.get(args.deckId);
  },
});

export const createWord = mutation({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
    ...createWordFields,
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db.get(args.deckId);
    if (!deck) {
      throw new Error("Deck not found");
    }
    const now = Date.now();
    const initialStats = defaultLinkStats(now);
    const queueFields = deriveQueueFields(initialStats);

    const wordId = await ctx.db.insert("words", {
      userId: args.userId,
      language: deck.language,
      target: args.target,
      reading: args.reading,
      romanization: args.romanization,
      meaning: args.meaning,
      example: args.example,
      audioUrl: args.audioUrl,
      tags: args.tags,
      createdAt: now,
    });

    await ctx.db.insert("deck_words", {
      deckId: args.deckId,
      wordId,
      position: now * 1000,
      snapshotReady: true,
      language: deck.language,
      target: args.target,
      reading: args.reading,
      romanization: args.romanization,
      meaning: args.meaning,
      example: args.example,
      audioUrl: args.audioUrl,
      ...initialStats,
    });

    await ctx.db.insert("practice_queue_entries", {
      deckId: args.deckId,
      userId: args.userId,
      wordId,
      position: now * 1000,
      language: deck.language,
      target: args.target,
      reading: args.reading,
      romanization: args.romanization,
      meaning: args.meaning,
      example: args.example,
      audioUrl: args.audioUrl,
      ...initialStats,
      ...queueFields,
      updatedAt: now,
    });

    if (deck.wordCount !== undefined) {
      await ctx.db.patch(args.deckId, { wordCount: deck.wordCount + 1 });
    }

    return await ctx.db.get(wordId);
  },
});

export const createWordsBatch = mutation({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
    words: v.array(v.object(createWordFields)),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db.get(args.deckId);
    if (!deck) {
      throw new Error("Deck not found");
    }

    const baseTime = Date.now();
    const basePosition = baseTime * 1000;

    const createdWords: unknown[] = [];
    for (const [index, input] of args.words.entries()) {
      const createdAt = baseTime + index;
      const initialStats = defaultLinkStats(createdAt);
      const queueFields = deriveQueueFields(initialStats);
      const wordId = await ctx.db.insert("words", {
        userId: args.userId,
        language: deck.language,
        target: input.target,
        reading: input.reading,
        romanization: input.romanization,
        meaning: input.meaning,
        example: input.example,
        audioUrl: input.audioUrl,
        tags: input.tags,
        createdAt,
      });

      await ctx.db.insert("deck_words", {
        deckId: args.deckId,
        wordId,
        position: basePosition + index,
        snapshotReady: true,
        language: deck.language,
        target: input.target,
        reading: input.reading,
        romanization: input.romanization,
        meaning: input.meaning,
        example: input.example,
        audioUrl: input.audioUrl,
        ...initialStats,
      });

      await ctx.db.insert("practice_queue_entries", {
        deckId: args.deckId,
        userId: args.userId,
        wordId,
        position: basePosition + index,
        language: deck.language,
        target: input.target,
        reading: input.reading,
        romanization: input.romanization,
        meaning: input.meaning,
        example: input.example,
        audioUrl: input.audioUrl,
        ...initialStats,
        ...queueFields,
        updatedAt: createdAt,
      });

      createdWords.push({
        _id: wordId,
        userId: args.userId,
        language: deck.language,
        target: input.target,
        reading: input.reading,
        romanization: input.romanization,
        meaning: input.meaning,
        example: input.example,
        audioUrl: input.audioUrl,
        tags: input.tags,
        createdAt,
      });
    }

    if (deck.wordCount !== undefined) {
      await ctx.db.patch(args.deckId, { wordCount: deck.wordCount + args.words.length });
    }

    return createdWords;
  },
});

export const listDeckWordsPage = query({
  args: {
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

    const words = await Promise.all(result.page.map(async (link) => await ctx.db.get(link.wordId)));

    return {
      page: words.filter((word) => word !== null),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

// One-off maintenance helpers for backfilling denormalized deck.wordCount.
export const listDeckIdsPage = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("decks")
      .order("asc")
      .paginate({
        cursor: args.cursor,
        numItems: args.limit,
      });

    return {
      page: result.page.map((deck) => ({
        deckId: deck._id,
        name: deck.name,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const countDeckWordsPage = query({
  args: {
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
      counted: result.page.length,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const setDeckWordCount = mutation({
  args: {
    deckId: v.id("decks"),
    wordCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deckId, { wordCount: args.wordCount });
    return { ok: true };
  },
});

export const listDeckWordLinksPage = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("deck_words")
      .order("asc")
      .paginate({
        cursor: args.cursor,
        numItems: args.limit,
      });

    return {
      page: result.page.map((link) => ({
        linkId: link._id,
        wordId: link.wordId,
        hasSnapshot:
          link.language !== undefined &&
          link.target !== undefined &&
          link.meaning !== undefined &&
          link.shapeStrength !== undefined &&
          link.typingStrength !== undefined &&
          link.listeningStrength !== undefined &&
          link.shapeDueAt !== undefined &&
          link.typingDueAt !== undefined &&
          link.listeningDueAt !== undefined,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const listDeckWordLinksMissingSnapshotPage = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("deck_words")
      .withIndex("by_snapshot_ready", (q) => q.eq("snapshotReady", false))
      .order("asc")
      .paginate({
        cursor: args.cursor,
        numItems: args.limit,
      });

    return {
      page: result.page.map((link) => ({
        linkId: link._id,
        wordId: link.wordId,
      })),
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const backfillDeckWordSnapshot = mutation({
  args: {
    linkId: v.id("deck_words"),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);
    if (!link) return { ok: false, reason: "link_not_found" };

    const patch = await getDeckWordSnapshotPatch(ctx, link);
    if (!patch) return { ok: false, reason: "source_not_found" };

    if (Object.keys(patch).length === 1 && patch.snapshotReady === true) {
      await ctx.db.patch(args.linkId, patch);
      return { ok: true, skipped: true };
    }

    await ctx.db.patch(args.linkId, patch);

    return { ok: true, skipped: false };
  },
});

export const isWordInDeck = query({
  args: {
    deckId: v.id("decks"),
    wordId: v.id("words"),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("deck_words")
      .withIndex("by_deck_word", (q) => q.eq("deckId", args.deckId).eq("wordId", args.wordId))
      .first();
    return !!link;
  },
});

export const updateWord = mutation({
  args: {
    wordId: v.id("words"),
    target: v.optional(v.string()),
    reading: v.optional(v.string()),
    romanization: v.optional(v.string()),
    meaning: v.optional(v.string()),
    example: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const word = await ctx.db.get(args.wordId);
    if (!word) return null;

    const updates = {
      ...(args.target !== undefined ? { target: args.target } : {}),
      ...(args.reading !== undefined ? { reading: args.reading } : {}),
      ...(args.romanization !== undefined ? { romanization: args.romanization } : {}),
      ...(args.meaning !== undefined ? { meaning: args.meaning } : {}),
      ...(args.example !== undefined ? { example: args.example } : {}),
      ...(args.audioUrl !== undefined ? { audioUrl: args.audioUrl } : {}),
      ...(args.tags !== undefined ? { tags: args.tags } : {}),
    };

    await ctx.db.patch(args.wordId, updates);

    const links = await ctx.db
      .query("deck_words")
      .withIndex("by_word", (q) => q.eq("wordId", args.wordId))
      .collect();

    await Promise.all(
      links.map((link) =>
        ctx.db.patch(link._id, {
          snapshotReady: true,
          ...(args.target !== undefined ? { target: args.target } : {}),
          ...(args.reading !== undefined ? { reading: args.reading } : {}),
          ...(args.romanization !== undefined ? { romanization: args.romanization } : {}),
          ...(args.meaning !== undefined ? { meaning: args.meaning } : {}),
          ...(args.example !== undefined ? { example: args.example } : {}),
          ...(args.audioUrl !== undefined ? { audioUrl: args.audioUrl } : {}),
        }),
      ),
    );

    const queueEntries = await ctx.db
      .query("practice_queue_entries")
      .withIndex("by_word", (q) => q.eq("wordId", args.wordId))
      .collect();

    await Promise.all(
      queueEntries.map((entry) =>
        ctx.db.patch(entry._id, {
          ...(args.target !== undefined ? { target: args.target } : {}),
          ...(args.reading !== undefined ? { reading: args.reading } : {}),
          ...(args.romanization !== undefined ? { romanization: args.romanization } : {}),
          ...(args.meaning !== undefined ? { meaning: args.meaning } : {}),
          ...(args.example !== undefined ? { example: args.example } : {}),
          ...(args.audioUrl !== undefined ? { audioUrl: args.audioUrl } : {}),
          updatedAt: Date.now(),
        }),
      ),
    );

    return await ctx.db.get(args.wordId);
  },
});

export const deleteWord = mutation({
  args: {
    wordId: v.id("words"),
  },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("deck_words")
      .withIndex("by_word", (q) => q.eq("wordId", args.wordId))
      .collect();
    const queueEntries = await ctx.db
      .query("practice_queue_entries")
      .withIndex("by_word", (q) => q.eq("wordId", args.wordId))
      .collect();

    const deckIds = [...new Set(links.map((link) => link.deckId))];

    await Promise.all(links.map((link) => ctx.db.delete(link._id)));
    await Promise.all(queueEntries.map((entry) => ctx.db.delete(entry._id)));

    for (const deckId of deckIds) {
      const deck = await ctx.db.get(deckId);
      if (deck?.wordCount !== undefined) {
        await ctx.db.patch(deck._id, { wordCount: Math.max(0, deck.wordCount - 1) });
      }
    }

    const stats = await ctx.db
      .query("word_channel_stats")
      .withIndex("by_word", (q) => q.eq("wordId", args.wordId))
      .collect();

    await Promise.all(stats.map((s) => ctx.db.delete(s._id)));

    await ctx.db.delete(args.wordId);
    return { ok: true };
  },
});

export const deleteWordsBatch = mutation({
  args: {
    deckId: v.id("decks"),
    wordIds: v.array(v.id("words")),
  },
  handler: async (ctx, args) => {
    let deleted = 0;
    const failedWordIds: string[] = [];

    for (const wordId of args.wordIds) {
      const inDeck = await ctx.db
        .query("deck_words")
        .withIndex("by_deck_word", (q) => q.eq("deckId", args.deckId).eq("wordId", wordId))
        .first();

      if (!inDeck) {
        failedWordIds.push(`${wordId}`);
        continue;
      }

      const links = await ctx.db
        .query("deck_words")
        .withIndex("by_word", (q) => q.eq("wordId", wordId))
        .collect();
      const queueEntries = await ctx.db
        .query("practice_queue_entries")
        .withIndex("by_word", (q) => q.eq("wordId", wordId))
        .collect();
      await Promise.all(links.map((link) => ctx.db.delete(link._id)));
      await Promise.all(queueEntries.map((entry) => ctx.db.delete(entry._id)));

      const deckIds = [...new Set(links.map((link) => link.deckId))];
      for (const linkedDeckId of deckIds) {
        const deck = await ctx.db.get(linkedDeckId);
        if (deck?.wordCount !== undefined) {
          await ctx.db.patch(deck._id, { wordCount: Math.max(0, deck.wordCount - 1) });
        }
      }

      const stats = await ctx.db
        .query("word_channel_stats")
        .withIndex("by_word", (q) => q.eq("wordId", wordId))
        .collect();
      await Promise.all(stats.map((s) => ctx.db.delete(s._id)));

      await ctx.db.delete(wordId);
      deleted += 1;
    }

    return { deleted, failedWordIds };
  },
});

export const deleteDeck = mutation({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db.get(args.deckId);
    if (!deck) return null;

    const remainingLink = await ctx.db
      .query("deck_words")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .first();

    if (remainingLink) {
      throw new Error("Deck still has words");
    }

    // Delete the deck itself
    const queueProgress = await ctx.db
      .query("practice_queue_progress")
      .withIndex("by_user_deck", (q) => q.eq("userId", deck.userId).eq("deckId", args.deckId))
      .first();
    if (queueProgress) {
      await ctx.db.delete(queueProgress._id);
    }
    await ctx.db.delete(args.deckId);
    return { ok: true };
  },
});

export const deleteDeckWordsPage = mutation({
  args: {
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

    for (const link of result.page) {
      await ctx.db.delete(link._id);
      const queueEntry = await ctx.db
        .query("practice_queue_entries")
        .withIndex("by_deck_word", (q) => q.eq("deckId", link.deckId).eq("wordId", link.wordId))
        .first();
      if (queueEntry) {
        await ctx.db.delete(queueEntry._id);
      }
    }

    return {
      deleted: result.page.length,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
