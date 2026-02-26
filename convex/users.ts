import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreateByEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) return existing;

    const now = Date.now();
    const id = await ctx.db.insert("users", {
      email: args.email,
      createdAt: now,
    });

    return await ctx.db.get(id);
  },
});

export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});
