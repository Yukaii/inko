import {
  DefaultThemes,
  type CreateWordsBatchInput,
  type CreateDeckInput,
  type CreateWordInput,
  type DeleteWordsBatchInput,
  type LanguageCode,
  type StartPracticeSessionInput,
  type SubmitPracticeCardInput,
  type ThemeConfig,
  type TypingMode,
  type UpdateDeckInput,
  type UpdateProfileInput,
  type UpdateWordInput,
  defaultWordChannelStats,
  nextDueAt,
  scoreListening,
  scoreShape,
  scoreTyping,
  applyAttempt,
} from "@inko/shared";
import { convex } from "../lib/convex.js";

type ConvexUser = {
  _id: string;
  email: string;
  displayName?: string;
  themeMode?: "dark" | "light";
  typingMode?: TypingMode;
  themes?: ThemeConfig;
  createdAt: number;
};
type ConvexDeck = {
  _id: string;
  userId: string;
  name: string;
  language: LanguageCode;
  archived: boolean;
  createdAt: number;
};
type ConvexWord = {
  _id: string;
  userId: string;
  language: LanguageCode;
  target: string;
  reading?: string;
  romanization?: string;
  meaning: string;
  example?: string;
  audioUrl?: string;
  tags: string[];
};

type WordStatsRow = {
  word: ConvexWord;
  stat?: {
    shapeStrength: number;
    typingStrength: number;
    listeningStrength: number;
    shapeDueAt: number;
    typingDueAt: number;
    listeningDueAt: number;
  };
};

export class RepositoryError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

function toUserDTO(user: ConvexUser) {
  const fallbackName = (user.email.split("@")[0] ?? "learner").replace(/[._-]+/g, " ").trim() || "learner";
  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName ?? fallbackName.slice(0, 60),
    themeMode: user.themeMode ?? "dark",
    typingMode: user.typingMode ?? "language_specific",
    themes: user.themes ?? DefaultThemes,
    createdAt: user.createdAt,
  };
}

function toDeckDTO(deck: ConvexDeck) {
  return {
    id: deck._id,
    userId: deck.userId,
    name: deck.name,
    language: deck.language,
    archived: deck.archived,
    createdAt: deck.createdAt,
  };
}

function toWordDTO(word: ConvexWord) {
  return {
    id: word._id,
    userId: word.userId,
    language: word.language,
    target: word.target,
    reading: word.reading,
    romanization: word.romanization,
    meaning: word.meaning,
    example: word.example,
    audioUrl: word.audioUrl,
    tags: word.tags,
  };
}

function selectNextPracticeCard(rows: WordStatsRow[], deckId: string, excludedWordIds: Set<string>) {
  const now = Date.now();
  const sorted = rows
    .filter((row) => !excludedWordIds.has(row.word._id))
    .map((row) => {
      const strength = row.stat
        ? Math.min(row.stat.shapeStrength, row.stat.typingStrength, row.stat.listeningStrength)
        : 50;
      const dueAt = row.stat
        ? Math.min(row.stat.shapeDueAt, row.stat.typingDueAt, row.stat.listeningDueAt)
        : now;
      return { ...row, strength, dueAt };
    })
    .sort((a, b) => a.strength - b.strength || a.dueAt - b.dueAt);

  const selected = sorted[0]?.word;
  if (!selected) return null;

  return {
    wordId: selected._id,
    deckId,
    language: selected.language,
    target: selected.target,
    reading: selected.reading,
    romanization: selected.romanization,
    meaning: selected.meaning,
    example: selected.example,
    audioUrl: selected.audioUrl,
  };
}

export const repository = {
  async getOrCreateUser(email: string) {
    const user = await convex.mutation("users:getOrCreateByEmail", { email });
    if (!user) {
      throw new Error("Failed to create user");
    }
    return toUserDTO(user as ConvexUser);
  },

  async getUserById(userId: string) {
    const user = await convex.query("users:getById", { userId });
    if (!user) return null;
    return toUserDTO(user as ConvexUser);
  },

  async updateUserProfile(userId: string, input: UpdateProfileInput) {
    const user = await convex.mutation("users:updateProfile", {
      userId,
      ...input,
    });
    if (!user) throw new RepositoryError("User not found", 404);
    return toUserDTO(user as ConvexUser);
  },

  async listDecks(userId: string) {
    const decks = (await convex.query("decks:listDecks", { userId })) as ConvexDeck[];
    return decks.map(toDeckDTO);
  },

  async createDeck(userId: string, input: CreateDeckInput) {
    const deck = await convex.mutation("decks:createDeck", {
      userId,
      name: input.name,
      language: input.language,
    });
    if (!deck) throw new Error("Failed to create deck");
    return toDeckDTO(deck as ConvexDeck);
  },

  async updateDeck(userId: string, deckId: string, input: UpdateDeckInput) {
    const existingDeck = (await convex.query("decks:getDeckById", { deckId })) as ConvexDeck | null;
    if (!existingDeck) throw new RepositoryError("Deck not found", 404);
    if (existingDeck.userId !== userId) throw new RepositoryError("Forbidden", 403);
    const updatedDeck = await convex.mutation("decks:updateDeck", { deckId, ...input });
    if (!updatedDeck) throw new RepositoryError("Deck not found", 404);
    return toDeckDTO(updatedDeck as ConvexDeck);
  },

  async listDeckWords(userId: string, deckId: string) {
    const deck = (await convex.query("decks:getDeckById", { deckId })) as ConvexDeck | null;
    if (!deck) throw new RepositoryError("Deck not found", 404);
    if (deck.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const words = (await convex.query("decks:listDeckWords", {
      deckId,
    })) as ConvexWord[];
    return words.map(toWordDTO);
  },

  async createWord(userId: string, deckId: string, input: CreateWordInput) {
    const deck = (await convex.query("decks:getDeckById", { deckId })) as ConvexDeck | null;
    if (!deck) throw new RepositoryError("Deck not found", 404);
    if (deck.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const word = await convex.mutation("decks:createWord", {
      userId,
      deckId,
      ...input,
      tags: input.tags ?? [],
    });
    if (!word) throw new Error("Failed to create word");
    return toWordDTO(word as ConvexWord);
  },

  async createWordsBatch(userId: string, deckId: string, input: CreateWordsBatchInput) {
    const deck = (await convex.query("decks:getDeckById", { deckId })) as ConvexDeck | null;
    if (!deck) throw new RepositoryError("Deck not found", 404);
    if (deck.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const words = (await convex.mutation("decks:createWordsBatch", {
      userId,
      deckId,
      words: input.words.map((word) => ({
        ...word,
        tags: word.tags ?? [],
      })),
    })) as ConvexWord[];

    return words.map(toWordDTO);
  },

  async updateWord(userId: string, wordId: string, input: UpdateWordInput) {
    const existingWord = (await convex.query("words:getById", { wordId })) as ConvexWord | null;
    if (!existingWord) throw new RepositoryError("Word not found", 404);
    if (existingWord.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const word = await convex.mutation("decks:updateWord", {
      wordId,
      ...input,
    });

    if (!word) throw new RepositoryError("Word not found", 404);
    return toWordDTO(word as ConvexWord);
  },

  async deleteWord(userId: string, wordId: string) {
    const existingWord = (await convex.query("words:getById", { wordId })) as ConvexWord | null;
    if (!existingWord) throw new RepositoryError("Word not found", 404);
    if (existingWord.userId !== userId) throw new RepositoryError("Forbidden", 403);

    await convex.mutation("decks:deleteWord", { wordId });
    return { ok: true };
  },

  async deleteWordsBatch(userId: string, deckId: string, input: DeleteWordsBatchInput) {
    const existingDeck = (await convex.query("decks:getDeckById", { deckId })) as ConvexDeck | null;
    if (!existingDeck) throw new RepositoryError("Deck not found", 404);
    if (existingDeck.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const result = (await convex.mutation("decks:deleteWordsBatch", {
      deckId,
      wordIds: input.wordIds,
    })) as { deleted: number; failedWordIds: string[] };

    return result;
  },

  async deleteDeck(userId: string, deckId: string) {
    const existingDeck = (await convex.query("decks:getDeckById", { deckId })) as ConvexDeck | null;
    if (!existingDeck) throw new RepositoryError("Deck not found", 404);
    if (existingDeck.userId !== userId) throw new RepositoryError("Forbidden", 403);

    await convex.mutation("decks:deleteDeck", { deckId });
    return { ok: true };
  },

  async startPracticeSession(userId: string, input: StartPracticeSessionInput) {
    const deck = (await convex.query("decks:getDeckById", { deckId: input.deckId })) as ConvexDeck | null;
    if (!deck) throw new RepositoryError("Deck not found", 404);
    if (deck.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const session = await convex.mutation("practice:startSession", {
      userId,
      deckId: input.deckId,
    });

    if (!session) throw new RepositoryError("Failed to start session", 500);

    const rows = (await convex.query("practice:listDeckWordsWithStats", {
      userId,
      deckId: input.deckId,
    })) as WordStatsRow[];

    if (rows.length === 0) {
      throw new RepositoryError("No words available in deck", 409);
    }

    const card = selectNextPracticeCard(rows, input.deckId, new Set());
    if (!card) throw new RepositoryError("No words available in deck", 409);
    const user = (await convex.query("users:getById", { userId })) as ConvexUser | null;

    return {
      sessionId: (session as any)._id as string,
      card,
      typingMode: user?.typingMode ?? "language_specific",
    };
  },

  async submitPracticeCard(userId: string, sessionId: string, wordId: string, input: SubmitPracticeCardInput) {
    if (!input.handwritingCompleted || !input.audioPlayed) {
      return {
        accepted: false,
        scores: { shape: 0, typing: 0, listening: 0 },
        nextDueAt: new Date().toISOString(),
      };
    }

    const session = (await convex.query("practice:getSessionById", { sessionId })) as
      | { _id: string; userId: string; deckId: string }
      | null;
    if (!session) {
      throw new RepositoryError("Session not found", 404);
    }
    if (session.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const word = (await convex.query("words:getById", { wordId })) as ConvexWord | null;
    if (!word) {
      throw new RepositoryError("Word not found for submission", 404);
    }
    if (word.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const inDeck = (await convex.query("decks:isWordInDeck", {
      deckId: session.deckId,
      wordId,
    })) as boolean;
    if (!inDeck) throw new RepositoryError("Word not in session deck", 403);
    const user = (await convex.query("users:getById", { userId })) as ConvexUser | null;

    const shape = scoreShape(input.handwritingCompleted);
    const typing = scoreTyping(
      input.typingInput,
      word.target,
      word.reading,
      word.romanization,
      input.typingMs,
      word.language,
      user?.typingMode ?? "language_specific",
    );
    const listening = scoreListening(input.listeningConfidence);

    if (typing === 0) {
      return {
        accepted: false,
        scores: { shape, typing, listening },
        nextDueAt: new Date().toISOString(),
      };
    }

    const existing = (await convex.query("practice:getWordStats", {
      userId,
      wordId,
    })) as any;

    const now = Date.now();
    const current = existing
      ? {
          shape: { strength: existing.shapeStrength, dueAt: existing.shapeDueAt },
          typing: { strength: existing.typingStrength, dueAt: existing.typingDueAt },
          listening: { strength: existing.listeningStrength, dueAt: existing.listeningDueAt },
        }
      : defaultWordChannelStats(now);

    const next = applyAttempt(current, { shape, typing, listening }, now);

    await convex.mutation("practice:upsertWordStats", {
      userId,
      wordId,
      shapeStrength: next.shape.strength,
      typingStrength: next.typing.strength,
      listeningStrength: next.listening.strength,
      shapeDueAt: next.shape.dueAt,
      typingDueAt: next.typing.dueAt,
      listeningDueAt: next.listening.dueAt,
      lastPracticedAt: now,
    });

    await convex.mutation("practice:addAttempt", {
      sessionId,
      wordId,
      shapeScore: shape,
      typingScore: typing,
      listeningScore: listening,
      typingMs: input.typingMs,
    });

    const rows = (await convex.query("practice:listDeckWordsWithStats", {
      userId,
      deckId: session.deckId,
    })) as WordStatsRow[];

    const attempts = (await convex.query("practice:listAttemptsBySession", { sessionId })) as Array<{ wordId: string }>;
    const attemptedWordIds = new Set(attempts.map((attempt) => attempt.wordId));
    const nextCard = selectNextPracticeCard(rows, session.deckId, attemptedWordIds);

    return {
      accepted: true,
      scores: { shape, typing, listening },
      nextDueAt: new Date(nextDueAt(next)).toISOString(),
      nextCard,
    };
  },

  async finishPracticeSession(userId: string, sessionId: string) {
    const existingSession = (await convex.query("practice:getSessionById", { sessionId })) as
      | { _id: string; userId: string }
      | null;
    if (!existingSession) throw new RepositoryError("Session not found", 404);
    if (existingSession.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const session = await convex.mutation("practice:finishSession", { sessionId });
    if (!session) throw new RepositoryError("Session not found", 404);

    const attempts = (await convex.query("practice:listAttemptsBySession", { sessionId })) as Array<{
      shapeScore: number;
      typingScore: number;
      listeningScore: number;
      submittedAt: number;
    }>;

    const count = attempts.length;
    const avg = (key: "shapeScore" | "typingScore" | "listeningScore") =>
      count === 0 ? 0 : Math.round(attempts.reduce((acc, item) => acc + item[key], 0) / count);

    const durationSeconds = Math.max(
      0,
      Math.round((((session as any).finishedAt ?? Date.now()) - (session as any).startedAt) / 1000),
    );

    await convex.mutation("practice:upsertDailyStats", {
      userId: (session as any).userId,
      cardsCompletedDelta: (session as any).cardsCompleted,
      secondsSpentDelta: durationSeconds,
      now: Date.now(),
    });

    return {
      sessionId,
      cardsCompleted: (session as any).cardsCompleted,
      avgShapeScore: avg("shapeScore"),
      avgTypingScore: avg("typingScore"),
      avgListeningScore: avg("listeningScore"),
      durationSeconds,
    };
  },

  async dashboardSummary(userId: string) {
    return await convex.query("dashboard:summary", { userId });
  },
};

export type Repository = typeof repository;
