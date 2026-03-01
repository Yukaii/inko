import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { DefaultThemes } from "@inko/shared";

function fallbackDisplayName(email: string) {
  const localPart = email.split("@")[0] ?? "learner";
  const normalized = localPart.replace(/[._-]+/g, " ").trim();
  return normalized.length > 0 ? normalized : "learner";
}

export const getOrCreateByEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .first();

    if (existing) return existing;

    const now = Date.now();
    const id = await ctx.db.insert("users", {
      email: args.email,
      displayName: fallbackDisplayName(args.email).slice(0, 60),
      themeMode: "dark",
      typingMode: "language_specific",
      ttsEnabled: true,
      themes: DefaultThemes,
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

export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    displayName: v.string(),
    themeMode: v.union(v.literal("dark"), v.literal("light")),
    typingMode: v.union(v.literal("language_specific"), v.literal("universal")),
    ttsEnabled: v.boolean(),
    themes: v.object({
      dark: v.object({
        accentOrange: v.string(),
        accentTeal: v.string(),
        bgPage: v.string(),
        bgCard: v.string(),
        bgElevated: v.string(),
        textPrimary: v.string(),
        textSecondary: v.string(),
        textOnAccent: v.string(),
      }),
      light: v.object({
        accentOrange: v.string(),
        accentTeal: v.string(),
        bgPage: v.string(),
        bgCard: v.string(),
        bgElevated: v.string(),
        textPrimary: v.string(),
        textSecondary: v.string(),
        textOnAccent: v.string(),
      }),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      displayName: args.displayName,
      themeMode: args.themeMode,
      typingMode: args.typingMode,
      ttsEnabled: args.ttsEnabled,
      themes: args.themes,
    });

    return await ctx.db.get(args.userId);
  },
});

export const updatePreferences = mutation({
  args: {
    userId: v.id("users"),
    ttsEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      ttsEnabled: args.ttsEnabled,
    });

    return await ctx.db.get(args.userId);
  },
});
