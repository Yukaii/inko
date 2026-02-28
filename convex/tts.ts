import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const persistWordAudio = internalMutation({
  args: {
    wordId: v.id("words"),
    audioStorageId: v.id("_storage"),
    audioUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const word = await ctx.db.get(args.wordId);
    if (!word) return null;

    await ctx.db.patch(args.wordId, {
      audioStorageId: args.audioStorageId,
      audioUrl: args.audioUrl,
    });

    const deckLinks = await ctx.db
      .query("deck_words")
      .withIndex("by_word", (q) => q.eq("wordId", args.wordId))
      .collect();

    await Promise.all(
      deckLinks.map((link) =>
        ctx.db.patch(link._id, {
          snapshotReady: true,
          audioUrl: args.audioUrl,
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
          audioUrl: args.audioUrl,
          updatedAt: Date.now(),
        }),
      ),
    );

    return { ok: true, audioUrl: args.audioUrl };
  },
});
