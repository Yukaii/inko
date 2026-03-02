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

const noteTypeValidator = v.object({
  name: v.string(),
  fields: v.array(v.string()),
});

const wordValidator = v.object({
  target: v.string(),
  reading: v.optional(v.string()),
  romanization: v.optional(v.string()),
  meaning: v.string(),
  example: v.optional(v.string()),
  audioUrl: v.optional(v.string()),
  tags: v.array(v.string()),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function ensureUniqueSlug(ctx: any, initialSlug: string) {
  let slug = initialSlug || "community-deck";
  let suffix = 1;
  while (await ctx.db.query("community_decks").withIndex("by_slug", (q: any) => q.eq("slug", slug)).first()) {
    suffix += 1;
    slug = `${initialSlug}-${suffix}`;
  }
  return slug;
}

async function buildDeckDetail(ctx: any, deck: any, viewerUserId?: string) {
  const comments = await ctx.db
    .query("community_deck_comments")
    .withIndex("by_deck_created_at", (q: any) => q.eq("deckId", deck._id))
    .order("desc")
    .collect();
  const viewerRating = viewerUserId
    ? await ctx.db
        .query("community_deck_ratings")
        .withIndex("by_user_deck", (q: any) => q.eq("userId", viewerUserId).eq("deckId", deck._id))
        .first()
    : null;

  return {
    ...deck,
    viewerRating: viewerRating?.rating,
    comments: comments.map((comment: any) => ({
      id: comment._id,
      userId: comment.userId,
      authorName: comment.authorName,
      body: comment.body,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    })),
  };
}

async function recomputeDeckRating(ctx: any, deckId: any) {
  const ratings = await ctx.db.query("community_deck_ratings").withIndex("by_deck", (q: any) => q.eq("deckId", deckId)).collect();
  const ratingCount = ratings.length;
  const rating = ratingCount === 0 ? 0 : ratings.reduce((sum: number, entry: any) => sum + entry.rating, 0) / ratingCount;
  await ctx.db.patch(deckId, {
    rating,
    ratingCount,
    updatedAt: Date.now(),
  });
}

export const listPublishedDecks = query({
  args: {
    language: v.optional(languageValidator),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedSearch = args.search?.trim().toLowerCase();
    const decks = args.language
      ? await ctx.db.query("community_decks").withIndex("by_language", (q) => q.eq("language", args.language!)).collect()
      : await ctx.db.query("community_decks").withIndex("by_updated_at").order("desc").collect();

    return decks
      .filter((deck) => {
        if (!normalizedSearch) return true;
        return [deck.title, deck.summary, deck.authorName, ...deck.tags].some((value) =>
          value.toLowerCase().includes(normalizedSearch),
        );
      })
      .sort((left, right) => right.updatedAt - left.updatedAt);
  },
});

export const getPublishedDeckBySlug = query({
  args: {
    slug: v.string(),
    viewerUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db.query("community_decks").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first();
    if (!deck) return null;
    return await buildDeckDetail(ctx, deck, args.viewerUserId);
  },
});

export const createSubmission = mutation({
  args: {
    submitterUserId: v.id("users"),
    submitterEmail: v.string(),
    title: v.string(),
    summary: v.string(),
    description: v.string(),
    language: languageValidator,
    difficulty: v.union(v.literal("Beginner"), v.literal("Intermediate"), v.literal("Advanced")),
    sourceKind: v.union(
      v.literal("apkg"),
      v.literal("colpkg"),
      v.literal("csv"),
      v.literal("tsv"),
      v.literal("community_clone"),
      v.literal("manual"),
    ),
    sourceName: v.string(),
    tags: v.array(v.string()),
    noteTypes: v.array(noteTypeValidator),
    words: v.array(wordValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("community_deck_submissions", {
      ...args,
      cardCount: args.words.length,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const listSubmissions = query({
  args: {
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
    submitterUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (args.submitterUserId) {
      const bySubmitter = await ctx.db
        .query("community_deck_submissions")
        .withIndex("by_submitter", (q) => q.eq("submitterUserId", args.submitterUserId!))
        .collect();
      return bySubmitter.sort((left, right) => right.createdAt - left.createdAt);
    }

    if (args.status) {
      const byStatus = await ctx.db
        .query("community_deck_submissions")
        .withIndex("by_status_created_at", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
      return byStatus;
    }

    const submissions = await ctx.db.query("community_deck_submissions").collect();
    return submissions.sort((left, right) => right.createdAt - left.createdAt);
  },
});

export const getSubmissionById = query({
  args: { submissionId: v.id("community_deck_submissions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.submissionId);
  },
});

export const reviewSubmission = mutation({
  args: {
    submissionId: v.id("community_deck_submissions"),
    reviewerUserId: v.id("users"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
    moderationNotes: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return null;

    const now = Date.now();
    let publishedDeckId = submission.publishedDeckId;

    if (args.status === "approved") {
      const requestedSlug = slugify(args.slug ?? submission.title);
      const uniqueSlug = await ensureUniqueSlug(ctx, requestedSlug);
      if (publishedDeckId) {
        await ctx.db.patch(publishedDeckId, {
          slug: uniqueSlug,
          title: submission.title,
          summary: submission.summary,
          description: submission.description,
          language: submission.language,
          difficulty: submission.difficulty,
          authorName: submission.submitterEmail,
          downloads: 0,
          rating: 0,
          ratingCount: 0,
          cardCount: submission.cardCount,
          tags: submission.tags,
          noteTypes: submission.noteTypes,
          words: submission.words,
          updatedAt: now,
        });
      } else {
        publishedDeckId = await ctx.db.insert("community_decks", {
          slug: uniqueSlug,
          title: submission.title,
          summary: submission.summary,
          description: submission.description,
          language: submission.language,
          difficulty: submission.difficulty,
          authorName: submission.submitterEmail,
          sourceSubmissionId: args.submissionId,
          publishedByUserId: args.reviewerUserId,
          downloads: 0,
          rating: 0,
          ratingCount: 0,
          cardCount: submission.cardCount,
          tags: submission.tags,
          noteTypes: submission.noteTypes,
          words: submission.words,
          publishedAt: now,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(args.submissionId, {
      status: args.status,
      moderationNotes: args.moderationNotes,
      reviewedByUserId: args.reviewerUserId,
      reviewedAt: now,
      publishedDeckId,
      updatedAt: now,
    });

    return {
      submission: await ctx.db.get(args.submissionId),
      publishedDeck: publishedDeckId ? await ctx.db.get(publishedDeckId) : null,
    };
  },
});

export const deleteSubmission = mutation({
  args: {
    submissionId: v.id("community_deck_submissions"),
    submitterUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return { ok: false, reason: "not_found" as const };
    if (submission.submitterUserId !== args.submitterUserId) {
      return { ok: false, reason: "forbidden" as const };
    }
    if (submission.status === "approved" || submission.publishedDeckId) {
      return { ok: false, reason: "published" as const };
    }

    await ctx.db.delete(args.submissionId);
    return { ok: true as const };
  },
});

export const incrementDeckDownloads = mutation({
  args: { deckId: v.id("community_decks") },
  handler: async (ctx, args) => {
    const deck = await ctx.db.get(args.deckId);
    if (!deck) return null;
    await ctx.db.patch(args.deckId, {
      downloads: deck.downloads + 1,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(args.deckId);
  },
});

export const rateDeck = mutation({
  args: {
    deckId: v.id("community_decks"),
    userId: v.id("users"),
    rating: v.number(),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db.get(args.deckId);
    if (!deck) return null;

    const existing = await ctx.db
      .query("community_deck_ratings")
      .withIndex("by_user_deck", (q) => q.eq("userId", args.userId).eq("deckId", args.deckId))
      .first();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        rating: args.rating,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("community_deck_ratings", {
        deckId: args.deckId,
        userId: args.userId,
        rating: args.rating,
        createdAt: now,
        updatedAt: now,
      });
    }

    await recomputeDeckRating(ctx, args.deckId);
    const updatedDeck = await ctx.db.get(args.deckId);
    return updatedDeck ? await buildDeckDetail(ctx, updatedDeck, args.userId) : null;
  },
});

export const addDeckComment = mutation({
  args: {
    deckId: v.id("community_decks"),
    userId: v.id("users"),
    authorName: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db.get(args.deckId);
    if (!deck) return null;

    const now = Date.now();
    await ctx.db.insert("community_deck_comments", {
      deckId: args.deckId,
      userId: args.userId,
      authorName: args.authorName,
      body: args.body.trim(),
      createdAt: now,
      updatedAt: now,
    });
    const updatedDeck = await ctx.db.get(args.deckId);
    return updatedDeck ? await buildDeckDetail(ctx, updatedDeck, args.userId) : null;
  },
});

export const deleteDeckComment = mutation({
  args: {
    deckId: v.id("community_decks"),
    commentId: v.id("community_deck_comments"),
    requesterUserId: v.id("users"),
    allowModerator: v.boolean(),
  },
  handler: async (ctx, args) => {
    const deck = await ctx.db.get(args.deckId);
    if (!deck) return { ok: false as const, reason: "deck_not_found" as const };

    const comment = await ctx.db.get(args.commentId);
    if (!comment || comment.deckId !== args.deckId) {
      return { ok: false as const, reason: "comment_not_found" as const };
    }

    const canDelete = comment.userId === args.requesterUserId || args.allowModerator;
    if (!canDelete) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    await ctx.db.delete(args.commentId);
    const updatedDeck = await ctx.db.get(args.deckId);
    if (!updatedDeck) return { ok: false as const, reason: "deck_not_found" as const };

    return {
      ok: true as const,
      deck: await buildDeckDetail(ctx, updatedDeck, args.requesterUserId),
    };
  },
});
