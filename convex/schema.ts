import { defineSchema, defineTable } from "convex/server";
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

export default defineSchema({
  users: defineTable({
    email: v.string(),
    displayName: v.optional(v.string()),
    themeMode: v.optional(v.union(v.literal("dark"), v.literal("light"))),
    typingMode: v.optional(v.union(v.literal("language_specific"), v.literal("universal"))),
    themes: v.optional(
      v.object({
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
    ),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  decks: defineTable({
    userId: v.id("users"),
    name: v.string(),
    language: languageValidator,
    archived: v.boolean(),
    wordCount: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_language", ["userId", "language"]),

  words: defineTable({
    userId: v.id("users"),
    language: languageValidator,
    target: v.string(),
    reading: v.optional(v.string()),
    romanization: v.optional(v.string()),
    meaning: v.string(),
    example: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    tags: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  deck_words: defineTable({
    deckId: v.id("decks"),
    wordId: v.id("words"),
    position: v.number(),
    snapshotReady: v.optional(v.boolean()),
    language: v.optional(languageValidator),
    target: v.optional(v.string()),
    reading: v.optional(v.string()),
    romanization: v.optional(v.string()),
    meaning: v.optional(v.string()),
    example: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    shapeStrength: v.optional(v.number()),
    typingStrength: v.optional(v.number()),
    listeningStrength: v.optional(v.number()),
    shapeDueAt: v.optional(v.number()),
    typingDueAt: v.optional(v.number()),
    listeningDueAt: v.optional(v.number()),
    lastPracticedAt: v.optional(v.number()),
  })
    .index("by_deck", ["deckId"])
    .index("by_deck_position", ["deckId", "position"])
    .index("by_snapshot_ready", ["snapshotReady"])
    .index("by_word", ["wordId"])
    .index("by_deck_word", ["deckId", "wordId"]),

  word_channel_stats: defineTable({
    userId: v.id("users"),
    wordId: v.id("words"),
    shapeStrength: v.number(),
    typingStrength: v.number(),
    listeningStrength: v.number(),
    shapeDueAt: v.number(),
    typingDueAt: v.number(),
    listeningDueAt: v.number(),
    lastPracticedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_word", ["wordId"])
    .index("by_user_word", ["userId", "wordId"])
    .index("by_user_shape_due", ["userId", "shapeDueAt"])
    .index("by_user_typing_due", ["userId", "typingDueAt"])
    .index("by_user_listening_due", ["userId", "listeningDueAt"]),

  practice_sessions: defineTable({
    userId: v.id("users"),
    deckId: v.id("decks"),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    cardsCompleted: v.number(),
    attemptedWordIds: v.optional(v.array(v.id("words"))),
  })
    .index("by_user", ["userId"])
    .index("by_user_deck", ["userId", "deckId"]),

  practice_attempts: defineTable({
    sessionId: v.id("practice_sessions"),
    wordId: v.id("words"),
    shapeScore: v.number(),
    typingScore: v.number(),
    listeningScore: v.number(),
    typingMs: v.number(),
    submittedAt: v.number(),
  }).index("by_session", ["sessionId"]),

  practice_queue_entries: defineTable({
    deckId: v.id("decks"),
    userId: v.id("users"),
    wordId: v.id("words"),
    position: v.number(),
    language: languageValidator,
    target: v.string(),
    reading: v.optional(v.string()),
    romanization: v.optional(v.string()),
    meaning: v.string(),
    example: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    shapeStrength: v.number(),
    typingStrength: v.number(),
    listeningStrength: v.number(),
    shapeDueAt: v.number(),
    typingDueAt: v.number(),
    listeningDueAt: v.number(),
    weakestStrength: v.number(),
    nextDueAt: v.number(),
    lastPracticedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_deck_word", ["deckId", "wordId"])
    .index("by_word", ["wordId"])
    .index("by_user_deck_due_strength_position", [
      "userId",
      "deckId",
      "nextDueAt",
      "weakestStrength",
      "position",
    ])
    .index("by_user_deck_position", ["userId", "deckId", "position"]),

  practice_queue_progress: defineTable({
    userId: v.id("users"),
    deckId: v.id("decks"),
    coverageCursorPosition: v.number(),
    updatedAt: v.number(),
  }).index("by_user_deck", ["userId", "deckId"]),

  deck_practice_progress: defineTable({
    userId: v.id("users"),
    deckId: v.id("decks"),
    nextPosition: v.number(),
    updatedAt: v.number(),
  }).index("by_user_deck", ["userId", "deckId"]),

  daily_stats: defineTable({
    userId: v.id("users"),
    date: v.string(),
    wordsCompleted: v.number(),
    secondsSpent: v.number(),
    streakCount: v.number(),
  })
    .index("by_user_date", ["userId", "date"])
    .index("by_user", ["userId"]),
});
