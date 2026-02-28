import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

function defaultQueueStats(now: number) {
  return {
    shapeStrength: 50,
    typingStrength: 50,
    listeningStrength: 50,
    shapeDueAt: now,
    typingDueAt: now,
    listeningDueAt: now,
    weakestStrength: 50,
    nextDueAt: now,
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

function relativePosition(position: number, coverageCursorPosition: number) {
  if (position >= coverageCursorPosition) return position - coverageCursorPosition;
  return Number.MAX_SAFE_INTEGER / 2 + position;
}

function sortQueueEntries(entries: any[], coverageCursorPosition: number) {
  return [...entries].sort(
    (a, b) =>
      a.nextDueAt - b.nextDueAt ||
      a.weakestStrength - b.weakestStrength ||
      relativePosition(a.position, coverageCursorPosition) - relativePosition(b.position, coverageCursorPosition) ||
      a.position - b.position,
  );
}

function toPracticeCard(entry: any) {
  return {
    wordId: `${entry.wordId}`,
    deckId: `${entry.deckId}`,
    language: entry.language,
    target: entry.target,
    reading: entry.reading,
    romanization: entry.romanization,
    meaning: entry.meaning,
    example: entry.example,
    audioUrl: entry.audioUrl,
  };
}

async function ensureQueueProgress(ctx: any, userId: any, deckId: any, coverageCursorPosition = 0) {
  const existing = await ctx.db
    .query("practice_queue_progress")
    .withIndex("by_user_deck", (q: any) => q.eq("userId", userId).eq("deckId", deckId))
    .first();

  if (existing) return existing;

  const id = await ctx.db.insert("practice_queue_progress", {
    userId,
    deckId,
    coverageCursorPosition,
    updatedAt: Date.now(),
  });
  return await ctx.db.get(id);
}

async function buildQueueEntryFromDeckWord(ctx: any, deckWord: any) {
  const deck = await ctx.db.get(deckWord.deckId);
  if (!deck) return null;

  const word =
    deckWord.language !== undefined && deckWord.target !== undefined && deckWord.meaning !== undefined
      ? {
          language: deckWord.language,
          target: deckWord.target,
          reading: deckWord.reading,
          romanization: deckWord.romanization,
          meaning: deckWord.meaning,
          example: deckWord.example,
          audioUrl: deckWord.audioUrl,
        }
      : await ctx.db.get(deckWord.wordId);
  if (!word) return null;

  const canonicalStats =
    deckWord.shapeStrength !== undefined &&
    deckWord.typingStrength !== undefined &&
    deckWord.listeningStrength !== undefined &&
    deckWord.shapeDueAt !== undefined &&
    deckWord.typingDueAt !== undefined &&
    deckWord.listeningDueAt !== undefined
      ? {
          shapeStrength: deckWord.shapeStrength,
          typingStrength: deckWord.typingStrength,
          listeningStrength: deckWord.listeningStrength,
          shapeDueAt: deckWord.shapeDueAt,
          typingDueAt: deckWord.typingDueAt,
          listeningDueAt: deckWord.listeningDueAt,
          lastPracticedAt: deckWord.lastPracticedAt,
        }
      : await ctx.db
          .query("word_channel_stats")
          .withIndex("by_user_word", (q: any) => q.eq("userId", deck.userId).eq("wordId", deckWord.wordId))
          .first();

  const stats = canonicalStats ?? defaultQueueStats(Date.now());
  const derived = deriveQueueFields(stats);

  return {
    deckId: deckWord.deckId,
    userId: deck.userId,
    wordId: deckWord.wordId,
    position: deckWord.position,
    language: word.language,
    target: word.target,
    reading: word.reading,
    romanization: word.romanization,
    meaning: word.meaning,
    example: word.example,
    audioUrl: word.audioUrl,
    shapeStrength: stats.shapeStrength,
    typingStrength: stats.typingStrength,
    listeningStrength: stats.listeningStrength,
    shapeDueAt: stats.shapeDueAt,
    typingDueAt: stats.typingDueAt,
    listeningDueAt: stats.listeningDueAt,
    weakestStrength: derived.weakestStrength,
    nextDueAt: derived.nextDueAt,
    lastPracticedAt: canonicalStats?.lastPracticedAt,
    updatedAt: Date.now(),
  };
}

async function upsertQueueEntry(ctx: any, entry: any) {
  const existing = await ctx.db
    .query("practice_queue_entries")
    .withIndex("by_deck_word", (q: any) => q.eq("deckId", entry.deckId).eq("wordId", entry.wordId))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, entry);
    return { created: false, entryId: existing._id };
  }

  const id = await ctx.db.insert("practice_queue_entries", entry);
  return { created: true, entryId: id };
}

async function listRankedQueueEntries(
  ctx: any,
  args: {
    userId: any;
    deckId: any;
    now: number;
    coverageCursorPosition: number;
    limit: number;
    excludeWordIds: any[];
  },
) {
  const excludeWordIds = new Set(args.excludeWordIds.map((id) => `${id}`));
  const fetchLimit = Math.max(args.limit + excludeWordIds.size + 32, 128);

  const dueEntries = await ctx.db
    .query("practice_queue_entries")
    .withIndex("by_user_deck_due_strength_position", (q: any) =>
      q.eq("userId", args.userId).eq("deckId", args.deckId).lte("nextDueAt", args.now),
    )
    .order("asc")
    .take(fetchLimit);

  let candidates = dueEntries.filter((entry: any) => !excludeWordIds.has(`${entry.wordId}`));

  if (candidates.length < args.limit) {
    const futureEntries = await ctx.db
      .query("practice_queue_entries")
      .withIndex("by_user_deck_due_strength_position", (q: any) =>
        q.eq("userId", args.userId).eq("deckId", args.deckId).gt("nextDueAt", args.now),
      )
      .order("asc")
      .take(fetchLimit);

    candidates = [
      ...candidates,
      ...futureEntries.filter((entry: any) => !excludeWordIds.has(`${entry.wordId}`)),
    ];
  }

  const ordered = sortQueueEntries(candidates, args.coverageCursorPosition).slice(0, args.limit);
  return {
    entries: ordered,
    nextCoverageCursorPosition:
      ordered.length === 0
        ? args.coverageCursorPosition
        : ((ordered[ordered.length - 1]?.position ?? args.coverageCursorPosition) as number) + 1,
  };
}

export const getProgress = query({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("practice_queue_progress")
      .withIndex("by_user_deck", (q) => q.eq("userId", args.userId).eq("deckId", args.deckId))
      .first();
  },
});

export const upsertProgress = mutation({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
    coverageCursorPosition: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("practice_queue_progress")
      .withIndex("by_user_deck", (q) => q.eq("userId", args.userId).eq("deckId", args.deckId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        coverageCursorPosition: args.coverageCursorPosition,
        updatedAt: args.updatedAt,
      });
      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("practice_queue_progress", {
      userId: args.userId,
      deckId: args.deckId,
      coverageCursorPosition: args.coverageCursorPosition,
      updatedAt: args.updatedAt,
    });

    return await ctx.db.get(id);
  },
});

export const getNextCard = query({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
    now: v.number(),
    coverageCursorPosition: v.number(),
  },
  handler: async (ctx, args) => {
    const ranked = await listRankedQueueEntries(ctx, {
      ...args,
      limit: 1,
      excludeWordIds: [],
    });
    const entry = ranked.entries[0] ?? null;
    return {
      card: entry ? toPracticeCard(entry) : null,
      nextCoverageCursorPosition: entry ? ranked.nextCoverageCursorPosition : args.coverageCursorPosition,
    };
  },
});

export const listSessionBuffer = query({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
    now: v.number(),
    coverageCursorPosition: v.number(),
    limit: v.number(),
    excludeWordIds: v.array(v.id("words")),
  },
  handler: async (ctx, args) => {
    const ranked = await listRankedQueueEntries(ctx, args);
    return {
      cards: ranked.entries.map((entry) => toPracticeCard(entry)),
      nextCoverageCursorPosition: ranked.nextCoverageCursorPosition,
    };
  },
});

export const upsertEntryFromDeckWord = mutation({
  args: {
    deckWordId: v.id("deck_words"),
  },
  handler: async (ctx, args) => {
    const deckWord = await ctx.db.get(args.deckWordId);
    if (!deckWord) return { ok: false, reason: "deck_word_not_found" };

    const entry = await buildQueueEntryFromDeckWord(ctx, deckWord);
    if (!entry) return { ok: false, reason: "source_not_found" };

    const result = await upsertQueueEntry(ctx, entry);
    await ensureQueueProgress(ctx, entry.userId, entry.deckId);

    return { ok: true, created: result.created };
  },
});

export const updateEntryStats = mutation({
  args: {
    wordId: v.id("words"),
    shapeStrength: v.number(),
    typingStrength: v.number(),
    listeningStrength: v.number(),
    shapeDueAt: v.number(),
    typingDueAt: v.number(),
    listeningDueAt: v.number(),
    lastPracticedAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("practice_queue_entries")
      .withIndex("by_word", (q) => q.eq("wordId", args.wordId))
      .collect();

    const derived = deriveQueueFields(args);
    await Promise.all(
      entries.map((entry) =>
        ctx.db.patch(entry._id, {
          shapeStrength: args.shapeStrength,
          typingStrength: args.typingStrength,
          listeningStrength: args.listeningStrength,
          shapeDueAt: args.shapeDueAt,
          typingDueAt: args.typingDueAt,
          listeningDueAt: args.listeningDueAt,
          weakestStrength: derived.weakestStrength,
          nextDueAt: derived.nextDueAt,
          lastPracticedAt: args.lastPracticedAt,
          updatedAt: args.updatedAt,
        }),
      ),
    );

    return { updated: entries.length };
  },
});

export const updateEntryContent = mutation({
  args: {
    wordId: v.id("words"),
    language: v.optional(languageValidator),
    target: v.optional(v.string()),
    reading: v.optional(v.string()),
    romanization: v.optional(v.string()),
    meaning: v.optional(v.string()),
    example: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("practice_queue_entries")
      .withIndex("by_word", (q) => q.eq("wordId", args.wordId))
      .collect();

    await Promise.all(
      entries.map((entry) =>
        ctx.db.patch(entry._id, {
          ...(args.language !== undefined ? { language: args.language } : {}),
          ...(args.target !== undefined ? { target: args.target } : {}),
          ...(args.reading !== undefined ? { reading: args.reading } : {}),
          ...(args.romanization !== undefined ? { romanization: args.romanization } : {}),
          ...(args.meaning !== undefined ? { meaning: args.meaning } : {}),
          ...(args.example !== undefined ? { example: args.example } : {}),
          ...(args.audioUrl !== undefined ? { audioUrl: args.audioUrl } : {}),
          updatedAt: args.updatedAt,
        }),
      ),
    );

    return { updated: entries.length };
  },
});

export const deleteEntry = mutation({
  args: {
    wordId: v.id("words"),
    deckId: v.optional(v.id("decks")),
  },
  handler: async (ctx, args) => {
    const entries = args.deckId
      ? await ctx.db
          .query("practice_queue_entries")
          .withIndex("by_deck_word", (q) => q.eq("deckId", args.deckId!).eq("wordId", args.wordId))
          .collect()
      : await ctx.db
          .query("practice_queue_entries")
          .withIndex("by_word", (q) => q.eq("wordId", args.wordId))
          .collect();

    await Promise.all(entries.map((entry) => ctx.db.delete(entry._id)));
    return { deleted: entries.length };
  },
});

export const listEntriesMissingPage = query({
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

    const missing = [];
    for (const link of result.page) {
      const existing = await ctx.db
        .query("practice_queue_entries")
        .withIndex("by_deck_word", (q) => q.eq("deckId", link.deckId).eq("wordId", link.wordId))
        .first();
      if (!existing) {
        missing.push({
          deckWordId: link._id,
          deckId: link.deckId,
          wordId: link.wordId,
        });
      }
    }

    return {
      page: missing,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const backfillEntriesPage = mutation({
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

    let created = 0;
    let updated = 0;
    const touchedDecks = new Set<string>();

    for (const link of result.page) {
      const entry = await buildQueueEntryFromDeckWord(ctx, link);
      if (!entry) continue;
      const upserted = await upsertQueueEntry(ctx, entry);
      if (upserted.created) created += 1;
      else updated += 1;
      touchedDecks.add(`${entry.userId}:${entry.deckId}`);
    }

    let initializedProgress = 0;
    for (const key of touchedDecks) {
      const [userId, deckId] = key.split(":");
      const existing = await ctx.db
        .query("practice_queue_progress")
        .withIndex("by_user_deck", (q: any) => q.eq("userId", userId).eq("deckId", deckId))
        .first();
      if (!existing) {
        await ensureQueueProgress(ctx, userId, deckId);
        initializedProgress += 1;
      }
    }

    return {
      processed: result.page.length,
      created,
      updated,
      initializedProgress,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const rebuildDeckQueue = mutation({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db.get(args.deckId);
    if (!deck) return { ok: false, reason: "deck_not_found" };

    const links = await ctx.db
      .query("deck_words")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    let created = 0;
    let updated = 0;
    for (const link of links) {
      const entry = await buildQueueEntryFromDeckWord(ctx, link);
      if (!entry) continue;
      const upserted = await upsertQueueEntry(ctx, entry);
      if (upserted.created) created += 1;
      else updated += 1;
    }

    await ensureQueueProgress(ctx, deck.userId, deck._id);
    return { ok: true, created, updated };
  },
});

export const rebuildDeckQueuePage = mutation({
  args: {
    deckId: v.id("decks"),
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db.get(args.deckId);
    if (!deck) return { ok: false, reason: "deck_not_found", processed: 0, created: 0, updated: 0 };

    const result = await ctx.db
      .query("deck_words")
      .withIndex("by_deck_position", (q) => q.eq("deckId", args.deckId))
      .paginate({
        cursor: args.cursor,
        numItems: args.limit,
      });

    let created = 0;
    let updated = 0;
    for (const link of result.page) {
      const entry = await buildQueueEntryFromDeckWord(ctx, link);
      if (!entry) continue;
      const upserted = await upsertQueueEntry(ctx, entry);
      if (upserted.created) created += 1;
      else updated += 1;
    }

    await ensureQueueProgress(ctx, deck.userId, deck._id);

    return {
      ok: true,
      processed: result.page.length,
      created,
      updated,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const rebuildAllQueuesPage = mutation({
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

    const rebuilt = [];
    for (const deck of result.page) {
      const links = await ctx.db
        .query("deck_words")
        .withIndex("by_deck", (q) => q.eq("deckId", deck._id))
        .collect();

      let created = 0;
      let updated = 0;
      for (const link of links) {
        const entry = await buildQueueEntryFromDeckWord(ctx, link);
        if (!entry) continue;
        const upserted = await upsertQueueEntry(ctx, entry);
        if (upserted.created) created += 1;
        else updated += 1;
      }
      await ensureQueueProgress(ctx, deck.userId, deck._id);
      rebuilt.push({ deckId: deck._id, created, updated });
    }

    return {
      page: rebuilt,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
