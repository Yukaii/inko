import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getDeckWordAudio = query({
  args: {
    deckId: v.id("decks"),
    wordId: v.id("words"),
    voice: v.string(),
    rate: v.union(v.literal("-20%"), v.literal("default"), v.literal("+20%")),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("deck_tts_audio")
      .withIndex("by_deck_word_voice_rate", (q) =>
        q.eq("deckId", args.deckId).eq("wordId", args.wordId).eq("voice", args.voice).eq("rate", args.rate),
      )
      .first();
  },
});

export const persistDeckWordAudio = internalMutation({
  args: {
    deckId: v.id("decks"),
    wordId: v.id("words"),
    voice: v.string(),
    rate: v.union(v.literal("-20%"), v.literal("default"), v.literal("+20%")),
    audioStorageId: v.id("_storage"),
    audioUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("deck_tts_audio")
      .withIndex("by_deck_word_voice_rate", (q) =>
        q.eq("deckId", args.deckId).eq("wordId", args.wordId).eq("voice", args.voice).eq("rate", args.rate),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        audioStorageId: args.audioStorageId,
        audioUrl: args.audioUrl,
        updatedAt: Date.now(),
      });
      return { ok: true, audioUrl: args.audioUrl };
    }

    await ctx.db.insert("deck_tts_audio", {
      deckId: args.deckId,
      wordId: args.wordId,
      voice: args.voice,
      rate: args.rate,
      audioStorageId: args.audioStorageId,
      audioUrl: args.audioUrl,
      updatedAt: Date.now(),
    });

    return { ok: true, audioUrl: args.audioUrl };
  },
});
