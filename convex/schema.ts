import { authTables } from "@convex-dev/auth/server";
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
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.string(),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    displayName: v.optional(v.string()),
    themeMode: v.optional(v.union(v.literal("dark"), v.literal("light"))),
    typingMode: v.optional(v.union(v.literal("language_specific"), v.literal("universal"))),
    ttsEnabled: v.optional(v.boolean()),
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
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  decks: defineTable({
    userId: v.id("users"),
    name: v.string(),
    language: languageValidator,
    archived: v.boolean(),
    ttsEnabled: v.optional(v.boolean()),
    ttsVoice: v.optional(v.string()),
    ttsRate: v.optional(v.union(v.literal("-20%"), v.literal("default"), v.literal("+20%"))),
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
    audioStorageId: v.optional(v.id("_storage")),
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

  deck_tts_audio: defineTable({
    deckId: v.id("decks"),
    wordId: v.id("words"),
    voice: v.string(),
    rate: v.union(v.literal("-20%"), v.literal("default"), v.literal("+20%")),
    audioStorageId: v.id("_storage"),
    audioUrl: v.string(),
    updatedAt: v.number(),
  })
    .index("by_deck_word_voice_rate", ["deckId", "wordId", "voice", "rate"])
    .index("by_word", ["wordId"])
    .index("by_deck", ["deckId"]),

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

  community_decks: defineTable({
    slug: v.string(),
    title: v.string(),
    summary: v.string(),
    description: v.string(),
    language: languageValidator,
    difficulty: v.union(v.literal("Beginner"), v.literal("Intermediate"), v.literal("Advanced")),
    authorName: v.string(),
    sourceSubmissionId: v.optional(v.id("community_deck_submissions")),
    publishedByUserId: v.optional(v.id("users")),
    downloads: v.number(),
    rating: v.number(),
    ratingCount: v.number(),
    cardCount: v.number(),
    tags: v.array(v.string()),
    noteTypes: v.array(
      v.object({
        name: v.string(),
        fields: v.array(v.string()),
      }),
    ),
    words: v.array(
      v.object({
        target: v.string(),
        reading: v.optional(v.string()),
        romanization: v.optional(v.string()),
        meaning: v.string(),
        example: v.optional(v.string()),
        audioUrl: v.optional(v.string()),
        tags: v.array(v.string()),
      }),
    ),
    publishedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_language", ["language"])
    .index("by_updated_at", ["updatedAt"]),

  community_deck_ratings: defineTable({
    deckId: v.id("community_decks"),
    userId: v.id("users"),
    rating: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_deck", ["deckId"])
    .index("by_user_deck", ["userId", "deckId"]),

  community_deck_comments: defineTable({
    deckId: v.id("community_decks"),
    userId: v.id("users"),
    authorName: v.string(),
    body: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_deck_created_at", ["deckId", "createdAt"])
    .index("by_user", ["userId"]),

  community_deck_submissions: defineTable({
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
    cardCount: v.number(),
    tags: v.array(v.string()),
    noteTypes: v.array(
      v.object({
        name: v.string(),
        fields: v.array(v.string()),
      }),
    ),
    words: v.array(
      v.object({
        target: v.string(),
        reading: v.optional(v.string()),
        romanization: v.optional(v.string()),
        meaning: v.string(),
        example: v.optional(v.string()),
        audioUrl: v.optional(v.string()),
        tags: v.array(v.string()),
      }),
    ),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    moderationNotes: v.optional(v.string()),
    reviewedByUserId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    publishedDeckId: v.optional(v.id("community_decks")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_submitter", ["submitterUserId"])
    .index("by_status", ["status"])
    .index("by_status_created_at", ["status", "createdAt"]),
});
