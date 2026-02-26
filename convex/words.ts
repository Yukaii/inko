import { query } from "./_generated/server";
import { v } from "convex/values";

export const getById = query({
  args: {
    wordId: v.id("words"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.wordId);
  },
});
