import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
    language: v.literal("ja"),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("decks", {
      userId: args.userId,
      name: args.name,
      language: args.language,
      archived: false,
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
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db.get(args.deckId);
    if (!deck) return null;

    await ctx.db.patch(args.deckId, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.archived !== undefined ? { archived: args.archived } : {}),
    });

    return await ctx.db.get(args.deckId);
  },
});

export const createWord = mutation({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
    target: v.string(),
    reading: v.optional(v.string()),
    romanization: v.optional(v.string()),
    meaning: v.string(),
    example: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const wordId = await ctx.db.insert("words", {
      userId: args.userId,
      language: "ja",
      target: args.target,
      reading: args.reading,
      romanization: args.romanization,
      meaning: args.meaning,
      example: args.example,
      audioUrl: args.audioUrl,
      tags: args.tags,
      createdAt: Date.now(),
    });

    const existing = await ctx.db
      .query("deck_words")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    await ctx.db.insert("deck_words", {
      deckId: args.deckId,
      wordId,
      position: existing.length,
    });

    return await ctx.db.get(wordId);
  },
});

export const listDeckWords = query({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("deck_words")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();

    const words = await Promise.all(
      links
        .sort((a, b) => a.position - b.position)
        .map(async (link) => ({ link, word: await ctx.db.get(link.wordId) })),
    );

    return words
      .filter((x) => !!x.word)
      .map((x) => ({
        ...x.word,
      }));
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

    await ctx.db.patch(args.wordId, {
      ...(args.target !== undefined ? { target: args.target } : {}),
      ...(args.reading !== undefined ? { reading: args.reading } : {}),
      ...(args.romanization !== undefined ? { romanization: args.romanization } : {}),
      ...(args.meaning !== undefined ? { meaning: args.meaning } : {}),
      ...(args.example !== undefined ? { example: args.example } : {}),
      ...(args.audioUrl !== undefined ? { audioUrl: args.audioUrl } : {}),
      ...(args.tags !== undefined ? { tags: args.tags } : {}),
    });

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
      .filter((q) => q.eq(q.field("wordId"), args.wordId))
      .collect();

    await Promise.all(links.map((link) => ctx.db.delete(link._id)));

    const stats = await ctx.db
      .query("word_channel_stats")
      .filter((q) => q.eq(q.field("wordId"), args.wordId))
      .collect();

    await Promise.all(stats.map((s) => ctx.db.delete(s._id)));

    await ctx.db.delete(args.wordId);
    return { ok: true };
  },
});

export const deleteDeck = mutation({
  args: {
    deckId: v.id("decks"),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db.get(args.deckId);
    if (!deck) return null;

    // Delete all deck_words links
    const links = await ctx.db
      .query("deck_words")
      .withIndex("by_deck", (q) => q.eq("deckId", args.deckId))
      .collect();
    await Promise.all(links.map((link) => ctx.db.delete(link._id)));

    // Delete the deck itself
    await ctx.db.delete(args.deckId);
    return { ok: true };
  },
});
