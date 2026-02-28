import {
  DefaultThemes,
  PRACTICE_SESSION_CARD_CAP_DEFAULT,
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
import { convex } from "../lib/convex";

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
  wordCount?: number;
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
  position: number;
  word: ConvexWord;
  stat?: {
    shapeStrength: number;
    typingStrength: number;
    listeningStrength: number;
    shapeDueAt: number;
    typingDueAt: number;
    listeningDueAt: number;
    lastPracticedAt?: number;
  };
};

type ConvexDeckPracticeProgress = {
  _id: string;
  userId: string;
  deckId: string;
  nextPosition: number;
  updatedAt: number;
};

type WordChannelStats = {
  shapeStrength: number;
  typingStrength: number;
  listeningStrength: number;
  shapeDueAt: number;
  typingDueAt: number;
  listeningDueAt: number;
};

type ConvexPracticeSession = {
  _id: string;
  userId: string;
  deckId: string;
  startedAt: number;
  finishedAt?: number;
  cardsCompleted: number;
  attemptedWordIds?: string[];
};

type PracticeSessionCacheEntry = {
  userId: string;
  deckId: string;
  rows: WordStatsRow[];
  attemptedWordIds: Set<string>;
  nextWindowStartPosition: number;
  updatedAt: number;
};

const CONVEX_ARRAY_ARG_LIMIT = 8192;
const BATCH_WORDS_CHUNK_SIZE = 200;
const DECK_DELETE_PAGE_SIZE = 500;
const SESSION_CACHE_TTL_MS = 10 * 60 * 1000;
const PRACTICE_CANDIDATE_WINDOW_SIZE = PRACTICE_SESSION_CARD_CAP_DEFAULT;

const practiceSessionCache = new Map<string, PracticeSessionCacheEntry>();

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export const PERFORMANCE_CONSTANTS = {
  CONVEX_ARRAY_ARG_LIMIT,
  BATCH_WORDS_CHUNK_SIZE,
  PRACTICE_CANDIDATE_WINDOW_SIZE,
};

export const testChunkArray = chunkArray;

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

async function getDeckPracticeProgress(userId: string, deckId: string) {
  return (await convex.query("practice:getDeckPracticeProgress", {
    userId,
    deckId,
  })) as ConvexDeckPracticeProgress | null;
}

async function advanceDeckPracticeWindow(userId: string, deckId: string, startPosition: number, maxRows = 20) {
  const result = (await convex.query("practice:listDeckWordsWithStatsFromPosition", {
    userId,
    deckId,
    startPosition,
    limit: maxRows,
  })) as { page: WordStatsRow[]; nextStartPosition: number };

  if (result.page.length > 0) {
    await convex.mutation("practice:upsertDeckPracticeProgress", {
      userId,
      deckId,
      nextPosition: result.nextStartPosition,
      updatedAt: Date.now(),
    });
  }

  return {
    rows: result.page,
    nextStartPosition: result.nextStartPosition,
  };
}

function getSessionCache(sessionId: string): PracticeSessionCacheEntry | null {
  const cached = practiceSessionCache.get(sessionId);
  if (!cached) return null;
  if (Date.now() - cached.updatedAt > SESSION_CACHE_TTL_MS) {
    practiceSessionCache.delete(sessionId);
    return null;
  }
  return cached;
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

  async listDeckWordsPage(userId: string, deckId: string, cursor: string | null, limit: number) {
    const deck = (await convex.query("decks:getDeckById", { deckId })) as ConvexDeck | null;
    if (!deck) throw new RepositoryError("Deck not found", 404);
    if (deck.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const safeLimit = Math.max(1, Math.min(500, limit));
    const page = (await convex.query("decks:listDeckWordsPage", {
      deckId,
      cursor,
      limit: safeLimit,
    })) as { page: ConvexWord[]; continueCursor: string; isDone: boolean };
    return {
      words: page.page.map(toWordDTO),
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
      totalCount: deck.wordCount ?? null,
    };
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

    const normalizedWords = input.words.map((word) => ({
      ...word,
      tags: word.tags ?? [],
    }));

    const chunkSize = Math.min(BATCH_WORDS_CHUNK_SIZE, CONVEX_ARRAY_ARG_LIMIT - 1);
    const chunks = chunkArray(normalizedWords, chunkSize);
    const createdWords: ConvexWord[] = [];

    for (const wordsChunk of chunks) {
      const chunkResult = (await convex.mutation("decks:createWordsBatch", {
        userId,
        deckId,
        words: wordsChunk,
      })) as ConvexWord[];
      createdWords.push(...chunkResult);
    }

    return createdWords.map(toWordDTO);
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

    const chunkSize = Math.min(BATCH_WORDS_CHUNK_SIZE, CONVEX_ARRAY_ARG_LIMIT - 1);
    const chunks = chunkArray(input.wordIds, chunkSize);

    let deleted = 0;
    const failedWordIds: string[] = [];

    for (const wordIdsChunk of chunks) {
      const chunkResult = (await convex.mutation("decks:deleteWordsBatch", {
        deckId,
        wordIds: wordIdsChunk,
      })) as { deleted: number; failedWordIds: string[] };

      deleted += chunkResult.deleted;
      failedWordIds.push(...chunkResult.failedWordIds);
    }

    return { deleted, failedWordIds };
  },

  async deleteDeck(userId: string, deckId: string) {
    const existingDeck = (await convex.query("decks:getDeckById", { deckId })) as ConvexDeck | null;
    if (!existingDeck) throw new RepositoryError("Deck not found", 404);
    if (existingDeck.userId !== userId) throw new RepositoryError("Forbidden", 403);

    let cursor: string | null = null;
    do {
      const result = (await convex.mutation("decks:deleteDeckWordsPage", {
        deckId,
        cursor,
        limit: DECK_DELETE_PAGE_SIZE,
      })) as { continueCursor: string; isDone: boolean };

      cursor = result.isDone ? null : result.continueCursor;
    } while (cursor !== null);

    await convex.mutation("decks:deleteDeck", { deckId });
    return { ok: true };
  },

  async startPracticeSession(userId: string, input: StartPracticeSessionInput) {
    const deck = (await convex.query("decks:getDeckById", { deckId: input.deckId })) as ConvexDeck | null;
    if (!deck) throw new RepositoryError("Deck not found", 404);
    if (deck.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const session = (await convex.mutation("practice:startSession", {
      userId,
      deckId: input.deckId,
    })) as ConvexPracticeSession | null;

    if (!session) throw new RepositoryError("Failed to start session", 500);

    const progress = await getDeckPracticeProgress(userId, input.deckId);
    const { rows, nextStartPosition } = await advanceDeckPracticeWindow(
      userId,
      input.deckId,
      progress?.nextPosition ?? 0,
      PRACTICE_CANDIDATE_WINDOW_SIZE,
    );

    if (rows.length === 0) {
      throw new RepositoryError("No words available in deck", 409);
    }

    const card = selectNextPracticeCard(rows, input.deckId, new Set());
    if (!card) throw new RepositoryError("No words available in deck", 409);

    practiceSessionCache.set(session._id, {
      userId,
      deckId: input.deckId,
      rows,
      attemptedWordIds: new Set(),
      nextWindowStartPosition: nextStartPosition,
      updatedAt: Date.now(),
    });

    const user = (await convex.query("users:getById", { userId })) as ConvexUser | null;

    return {
      sessionId: session._id,
      card,
      typingMode: user?.typingMode ?? "language_specific",
      sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
      cardsCompleted: session.cardsCompleted,
      remainingCards: Math.max(0, PRACTICE_SESSION_CARD_CAP_DEFAULT - session.cardsCompleted),
    };
  },

  async submitPracticeCard(userId: string, sessionId: string, wordId: string, input: SubmitPracticeCardInput) {
    if (!input.handwritingCompleted || !input.audioPlayed) {
      return {
        accepted: false,
        scores: { shape: 0, typing: 0, listening: 0 },
        nextDueAt: new Date().toISOString(),
        sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
      };
    }

    const session = (await convex.query("practice:getSessionById", { sessionId })) as ConvexPracticeSession | null;
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
        sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
        cardsCompleted: session.cardsCompleted,
        remainingCards: Math.max(0, PRACTICE_SESSION_CARD_CAP_DEFAULT - session.cardsCompleted),
      };
    }

    const existing = (await convex.query("practice:getWordStats", {
      userId,
      wordId,
    })) as WordChannelStats | null;

    const now = Date.now();
    const current = existing
      ? {
          shape: { strength: existing.shapeStrength, dueAt: existing.shapeDueAt },
          typing: { strength: existing.typingStrength, dueAt: existing.typingDueAt },
          listening: { strength: existing.listeningStrength, dueAt: existing.listeningDueAt },
        }
      : defaultWordChannelStats(now);

    const next = applyAttempt(current, { shape, typing, listening }, now);

    const attemptResult = (await convex.mutation("practice:addAttempt", {
      sessionId,
      wordId,
      shapeScore: shape,
      typingScore: typing,
      listeningScore: listening,
      typingMs: input.typingMs,
      maxCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
    })) as { ok: boolean; capped: boolean; cardsCompleted: number };

    if (attemptResult.capped) {
      return {
        accepted: false,
        scores: { shape, typing, listening },
        nextDueAt: new Date(nextDueAt(next)).toISOString(),
        nextCard: null,
        sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
        cardsCompleted: attemptResult.cardsCompleted,
        remainingCards: 0,
        sessionCapped: true,
      };
    }

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

    const cardsCompleted = attemptResult.cardsCompleted;
    const remainingCards = Math.max(0, PRACTICE_SESSION_CARD_CAP_DEFAULT - cardsCompleted);
    const sessionCapped = remainingCards === 0;
    if (sessionCapped) {
      return {
        accepted: true,
        scores: { shape, typing, listening },
        nextDueAt: new Date(nextDueAt(next)).toISOString(),
        nextCard: null,
        sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
        cardsCompleted,
        remainingCards,
        sessionCapped,
      };
    }

    const attemptedWordIds = new Set(session.attemptedWordIds ?? []);
    attemptedWordIds.add(wordId);

    const cached = getSessionCache(sessionId);
    let candidateRows: WordStatsRow[];
    let nextWindowStartPosition = 0;

    if (cached && cached.userId === userId && cached.deckId === session.deckId) {
      cached.attemptedWordIds = new Set([...cached.attemptedWordIds, ...attemptedWordIds]);

      const row = cached.rows.find((candidate) => candidate.word._id === wordId);
      if (row) {
        row.stat = {
          shapeStrength: next.shape.strength,
          typingStrength: next.typing.strength,
          listeningStrength: next.listening.strength,
          shapeDueAt: next.shape.dueAt,
          typingDueAt: next.typing.dueAt,
          listeningDueAt: next.listening.dueAt,
          lastPracticedAt: now,
        };
      }

      cached.updatedAt = Date.now();
      attemptedWordIds.clear();
      for (const attemptedWordId of cached.attemptedWordIds) attemptedWordIds.add(attemptedWordId);
      candidateRows = cached.rows;
      nextWindowStartPosition = cached.nextWindowStartPosition;
    } else {
      const progress = await getDeckPracticeProgress(userId, session.deckId);
      const nextWindow = await advanceDeckPracticeWindow(
        userId,
        session.deckId,
        progress?.nextPosition ?? 0,
        PRACTICE_CANDIDATE_WINDOW_SIZE,
      );
      candidateRows = nextWindow.rows;
      nextWindowStartPosition = nextWindow.nextStartPosition;
      practiceSessionCache.set(sessionId, {
        userId,
        deckId: session.deckId,
        rows: candidateRows,
        attemptedWordIds,
        nextWindowStartPosition,
        updatedAt: Date.now(),
      });
    }

    let nextCard = selectNextPracticeCard(candidateRows, session.deckId, attemptedWordIds);
    if (!nextCard) {
      const refreshedWindow = await advanceDeckPracticeWindow(
        userId,
        session.deckId,
        nextWindowStartPosition,
        PRACTICE_CANDIDATE_WINDOW_SIZE,
      );
      nextCard = selectNextPracticeCard(refreshedWindow.rows, session.deckId, attemptedWordIds);
      if (nextCard) {
        practiceSessionCache.set(sessionId, {
          userId,
          deckId: session.deckId,
          rows: refreshedWindow.rows,
          attemptedWordIds,
          nextWindowStartPosition: refreshedWindow.nextStartPosition,
          updatedAt: Date.now(),
        });
      } else {
        practiceSessionCache.delete(sessionId);
      }
    }

    return {
      accepted: true,
      scores: { shape, typing, listening },
      nextDueAt: new Date(nextDueAt(next)).toISOString(),
      nextCard,
      sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
      cardsCompleted,
      remainingCards,
      sessionCapped,
    };
  },

  async finishPracticeSession(userId: string, sessionId: string) {
    const existingSession = (await convex.query("practice:getSessionById", { sessionId })) as
      | { _id: string; userId: string }
      | null;
    if (!existingSession) throw new RepositoryError("Session not found", 404);
    if (existingSession.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const session = (await convex.mutation("practice:finishSession", {
      sessionId,
    })) as ConvexPracticeSession | null;
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
      Math.round(((session.finishedAt ?? Date.now()) - session.startedAt) / 1000),
    );

    await convex.mutation("practice:upsertDailyStats", {
      userId: session.userId,
      cardsCompletedDelta: session.cardsCompleted,
      secondsSpentDelta: durationSeconds,
      now: Date.now(),
    });

    practiceSessionCache.delete(sessionId);

    return {
      sessionId,
      cardsCompleted: session.cardsCompleted,
      avgShapeScore: avg("shapeScore"),
      avgTypingScore: avg("typingScore"),
      avgListeningScore: avg("listeningScore"),
      durationSeconds,
    };
  },

  async dashboardSummary(userId: string) {
    return await convex.query("dashboard:summary", { userId });
  },

  async dashboardStats(userId: string) {
    return await convex.query("dashboard:summaryStats", { userId });
  },

  async dashboardRecentSessions(userId: string) {
    return await convex.query("dashboard:recentSessions", { userId });
  },
};

export type Repository = typeof repository;
