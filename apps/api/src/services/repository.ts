import {
  DefaultThemes,
  getDefaultEdgeTtsVoice,
  PRACTICE_SESSION_CARD_CAP_DEFAULT,
  type PracticeCardDTO,
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
  type UpdatePreferencesInput,
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
import { tracePractice } from "../lib/diagnostics";

type ConvexUser = {
  _id: string;
  email: string;
  displayName?: string;
  themeMode?: "dark" | "light";
  typingMode?: TypingMode;
  ttsEnabled?: boolean;
  themes?: ThemeConfig;
  createdAt: number;
};
type ConvexDeck = {
  _id: string;
  userId: string;
  name: string;
  language: LanguageCode;
  archived: boolean;
  ttsEnabled?: boolean;
  ttsVoice?: string;
  ttsRate?: "-20%" | "default" | "+20%";
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

type WordChannelStats = {
  shapeStrength: number;
  typingStrength: number;
  listeningStrength: number;
  shapeDueAt: number;
  typingDueAt: number;
  listeningDueAt: number;
};

type ConvexPracticeQueueProgress = {
  _id: string;
  userId: string;
  deckId: string;
  coverageCursorPosition: number;
  updatedAt: number;
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
  cards: PracticeCardDTO[];
  attemptedWordIds: Set<string>;
  nextCoverageCursorPosition: number;
  bufferBuiltAt: number;
  updatedAt: number;
  bufferWarmPromise?: Promise<void>;
};

const CONVEX_ARRAY_ARG_LIMIT = 8192;
const BATCH_WORDS_CHUNK_SIZE = 200;
const DECK_DELETE_PAGE_SIZE = 500;
const SESSION_CACHE_TTL_MS = 10 * 60 * 1000;
const PRACTICE_SESSION_BUFFER_SIZE = Math.max(0, PRACTICE_SESSION_CARD_CAP_DEFAULT - 1);
const PRACTICE_TTS_PREFETCH_WINDOW = 7;
const PRACTICE_QUEUE_RECOVERY_REBUILD_LIMIT = 256;

const practiceSessionCache = new Map<string, PracticeSessionCacheEntry>();

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function measureAsync<T>(fn: () => Promise<T>) {
  const startedAt = Date.now();
  const value = await fn();
  return { value, durationMs: Date.now() - startedAt };
}

export const PERFORMANCE_CONSTANTS = {
  CONVEX_ARRAY_ARG_LIMIT,
  BATCH_WORDS_CHUNK_SIZE,
  PRACTICE_SESSION_BUFFER_SIZE,
  PRACTICE_TTS_PREFETCH_WINDOW,
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
    ttsEnabled: user.ttsEnabled ?? true,
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
    ttsEnabled: deck.ttsEnabled ?? true,
    ttsVoice: deck.ttsVoice ?? getDefaultEdgeTtsVoice(deck.language),
    ttsRate: deck.ttsRate ?? "default",
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

async function getPracticeQueueProgress(userId: string, deckId: string) {
  return (await convex.query("practiceQueue:getProgress", {
    userId,
    deckId,
  })) as ConvexPracticeQueueProgress | null;
}

async function upsertPracticeQueueProgress(userId: string, deckId: string, coverageCursorPosition: number) {
  return await convex.mutation("practiceQueue:upsertProgress", {
    userId,
    deckId,
    coverageCursorPosition,
    updatedAt: Date.now(),
  });
}

async function getNextQueuedCard(userId: string, deckId: string, coverageCursorPosition: number) {
  return (await convex.query("practiceQueue:getNextCard", {
    userId,
    deckId,
    now: Date.now(),
    coverageCursorPosition,
  })) as { card: PracticeCardDTO | null; nextCoverageCursorPosition: number };
}

async function rebuildPracticeQueueForDeck(deckId: string) {
  return (await convex.mutation("practiceQueue:rebuildDeckQueuePage", {
    deckId,
    cursor: null,
    limit: PRACTICE_QUEUE_RECOVERY_REBUILD_LIMIT,
  })) as { ok: boolean; processed?: number; created?: number; updated?: number; reason?: string };
}

async function listQueuedPracticeCards(
  userId: string,
  deckId: string,
  coverageCursorPosition: number,
  limit: number,
  excludeWordIds: string[],
) {
  return (await convex.query("practiceQueue:listSessionBuffer", {
    userId,
    deckId,
    now: Date.now(),
    coverageCursorPosition,
    limit,
    excludeWordIds,
  })) as { cards: PracticeCardDTO[]; nextCoverageCursorPosition: number };
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

function takeNextCachedCard(cache: PracticeSessionCacheEntry, excludedWordIds: Set<string>) {
  while (cache.cards.length > 0) {
    const nextCard = cache.cards.shift()!;
    if (!excludedWordIds.has(nextCard.wordId)) {
      return nextCard;
    }
  }
  return null;
}

function peekUpcomingCachedCards(
  cache: PracticeSessionCacheEntry,
  excludedWordIds: Set<string>,
  limit = PRACTICE_TTS_PREFETCH_WINDOW,
) {
  const upcoming: PracticeCardDTO[] = [];
  for (const queuedCard of cache.cards) {
    if (excludedWordIds.has(queuedCard.wordId)) continue;
    upcoming.push(queuedCard);
    if (upcoming.length >= limit) break;
  }
  return upcoming;
}

async function warmPracticeSessionBuffer(
  sessionId: string,
  userId: string,
  deckId: string,
  coverageCursorPosition: number,
  excludeWordIds: string[],
) {
  const bufferFetch = await measureAsync(async () =>
    await listQueuedPracticeCards(
      userId,
      deckId,
      coverageCursorPosition,
      PRACTICE_SESSION_BUFFER_SIZE,
      excludeWordIds,
    ),
  );
  const cache = getSessionCache(sessionId);
  if (!cache || cache.userId !== userId || cache.deckId !== deckId) return;

  cache.cards = bufferFetch.value.cards;
  cache.nextCoverageCursorPosition = bufferFetch.value.nextCoverageCursorPosition;
  cache.bufferBuiltAt = Date.now();
  cache.updatedAt = Date.now();
  cache.bufferWarmPromise = undefined;

  const progressUpdate = await measureAsync(async () =>
    await upsertPracticeQueueProgress(userId, deckId, bufferFetch.value.nextCoverageCursorPosition),
  );

  tracePractice({
    event: "session_buffer_warm",
    userId,
    sessionId,
    deckId,
    durationMs: bufferFetch.durationMs + progressUpdate.durationMs,
    queueBufferWarmMs: bufferFetch.durationMs,
    queueProgressUpdateMs: progressUpdate.durationMs,
    bufferCards: bufferFetch.value.cards.length,
    nextCoverageCursorPosition: bufferFetch.value.nextCoverageCursorPosition,
  });
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

  async updateUserPreferences(userId: string, input: UpdatePreferencesInput) {
    const user = await convex.mutation("users:updatePreferences", {
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

  async getWordById(userId: string, wordId: string) {
    const word = (await convex.query("words:getById", { wordId })) as ConvexWord | null;
    if (!word) throw new RepositoryError("Word not found", 404);
    if (word.userId !== userId) throw new RepositoryError("Forbidden", 403);
    return toWordDTO(word);
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
    const overallStartedAt = Date.now();
    const deckLookup = await measureAsync(
      async () => (await convex.query("decks:getDeckById", { deckId: input.deckId })) as ConvexDeck | null,
    );
    const deck = deckLookup.value;
    if (!deck) throw new RepositoryError("Deck not found", 404);
    if (deck.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const sessionCreation = await measureAsync(
      async () =>
        (await convex.mutation("practice:startSession", {
          userId,
          deckId: input.deckId,
        })) as ConvexPracticeSession | null,
    );
    const session = sessionCreation.value;

    if (!session) throw new RepositoryError("Failed to start session", 500);

    const progressLookup = await measureAsync(async () => await getPracticeQueueProgress(userId, input.deckId));
    const firstCardFetch = await measureAsync(async () =>
      await getNextQueuedCard(
        userId,
        input.deckId,
        progressLookup.value?.coverageCursorPosition ?? 0,
      ),
    );
    let queueRebuildMs = 0;
    let queueRebuildTriggered = false;
    let queueRebuildCreated = 0;
    let queueRebuildUpdated = 0;
    let firstCardResult = firstCardFetch.value;

    if (!firstCardResult.card && (deck.wordCount ?? 1) > 0) {
      queueRebuildTriggered = true;
      const rebuild = await measureAsync(async () => await rebuildPracticeQueueForDeck(input.deckId));
      queueRebuildMs = rebuild.durationMs;
      queueRebuildCreated = rebuild.value.created ?? 0;
      queueRebuildUpdated = rebuild.value.updated ?? 0;

      if (rebuild.value.ok) {
        const retriedFirstCardFetch = await measureAsync(async () =>
          await getNextQueuedCard(
            userId,
            input.deckId,
            progressLookup.value?.coverageCursorPosition ?? 0,
          ),
        );
        firstCardResult = retriedFirstCardFetch.value;
        firstCardFetch.durationMs += retriedFirstCardFetch.durationMs;
      }
    }

    const { card, nextCoverageCursorPosition } = firstCardResult;

    if (!card) {
      throw new RepositoryError("No words available in deck", 409);
    }

    const progressUpdate = await measureAsync(async () =>
      await upsertPracticeQueueProgress(userId, input.deckId, nextCoverageCursorPosition),
    );

    practiceSessionCache.set(session._id, {
      userId,
      deckId: input.deckId,
      cards: [],
      attemptedWordIds: new Set(),
      nextCoverageCursorPosition,
      bufferBuiltAt: 0,
      updatedAt: Date.now(),
    });

    const bufferWarmPromise = warmPracticeSessionBuffer(
      session._id,
      userId,
      input.deckId,
      nextCoverageCursorPosition,
      [card.wordId],
    ).catch(() => {
      const cache = getSessionCache(session._id);
      if (cache) cache.bufferWarmPromise = undefined;
    });
    const cache = getSessionCache(session._id);
    if (cache) {
      cache.bufferWarmPromise = bufferWarmPromise;
    }
    await bufferWarmPromise;
    const warmedCache = getSessionCache(session._id);
    const upcomingCards = warmedCache
      ? peekUpcomingCachedCards(warmedCache, new Set([card.wordId]))
      : [];

    const userLookup = await measureAsync(
      async () => (await convex.query("users:getById", { userId })) as ConvexUser | null,
    );
    const user = userLookup.value;

    tracePractice({
      event: "session_start",
      userId,
      deckId: input.deckId,
      totalMs: Date.now() - overallStartedAt,
      durationMs: Date.now() - overallStartedAt,
      deckLookupMs: deckLookup.durationMs,
      sessionCreationMs: sessionCreation.durationMs,
      queueProgressLookupMs: progressLookup.durationMs,
      queueFirstCardMs: firstCardFetch.durationMs,
      queueProgressUpdateMs: progressUpdate.durationMs,
      queueRebuildTriggered,
      queueRebuildMs,
      queueRebuildCreated,
      queueRebuildUpdated,
      userLookupMs: userLookup.durationMs,
      bufferWarmStarted: true,
      nextCoverageCursorPosition,
    });

    return {
      sessionId: session._id,
      card,
      upcomingCards,
      typingMode: user?.typingMode ?? "language_specific",
      ttsEnabled: deck.ttsEnabled ?? true,
      ttsVoice: deck.ttsVoice ?? getDefaultEdgeTtsVoice(deck.language),
      ttsRate: deck.ttsRate ?? "default",
      sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
      cardsCompleted: session.cardsCompleted,
      remainingCards: Math.max(0, PRACTICE_SESSION_CARD_CAP_DEFAULT - session.cardsCompleted),
    };
  },

  async submitPracticeCard(userId: string, sessionId: string, wordId: string, input: SubmitPracticeCardInput) {
    const overallStartedAt = Date.now();
    if (!input.handwritingCompleted || !input.audioPlayed) {
      return {
        accepted: false,
        scores: { shape: 0, typing: 0, listening: 0 },
        nextDueAt: new Date().toISOString(),
        sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
      };
    }

    const sessionLookup = await measureAsync(
      async () => (await convex.query("practice:getSessionById", { sessionId })) as ConvexPracticeSession | null,
    );
    const session = sessionLookup.value;
    if (!session) {
      throw new RepositoryError("Session not found", 404);
    }
    if (session.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const wordLookup = await measureAsync(
      async () => (await convex.query("words:getById", { wordId })) as ConvexWord | null,
    );
    const word = wordLookup.value;
    if (!word) {
      throw new RepositoryError("Word not found for submission", 404);
    }
    if (word.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const inDeckCheck = await measureAsync(
      async () =>
        (await convex.query("decks:isWordInDeck", {
          deckId: session.deckId,
          wordId,
        })) as boolean,
    );
    const inDeck = inDeckCheck.value;
    if (!inDeck) throw new RepositoryError("Word not in session deck", 403);
    const userLookup = await measureAsync(
      async () => (await convex.query("users:getById", { userId })) as ConvexUser | null,
    );
    const user = userLookup.value;

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

    const statsLookup = await measureAsync(
      async () =>
        (await convex.query("practice:getWordStats", {
          userId,
          wordId,
        })) as WordChannelStats | null,
    );
    const existing = statsLookup.value;

    const now = Date.now();
    const current = existing
      ? {
          shape: { strength: existing.shapeStrength, dueAt: existing.shapeDueAt },
          typing: { strength: existing.typingStrength, dueAt: existing.typingDueAt },
          listening: { strength: existing.listeningStrength, dueAt: existing.listeningDueAt },
        }
      : defaultWordChannelStats(now);

    const next = applyAttempt(current, { shape, typing, listening }, now);

    const attemptMutation = await measureAsync(
      async () =>
        (await convex.mutation("practice:addAttempt", {
          sessionId,
          wordId,
          shapeScore: shape,
          typingScore: typing,
          listeningScore: listening,
          typingMs: input.typingMs,
          maxCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
        })) as { ok: boolean; capped: boolean; cardsCompleted: number },
    );
    const attemptResult = attemptMutation.value;

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

    const upsertStatsMutation = await measureAsync(async () => {
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
    });
    const updateQueueStatsMutation = await measureAsync(async () => {
      await convex.mutation("practiceQueue:updateEntryStats", {
        wordId,
        shapeStrength: next.shape.strength,
        typingStrength: next.typing.strength,
        listeningStrength: next.listening.strength,
        shapeDueAt: next.shape.dueAt,
        typingDueAt: next.typing.dueAt,
        listeningDueAt: next.listening.dueAt,
        lastPracticedAt: now,
        updatedAt: now,
      });
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
    let cacheHit = false;
    let queueProgressLookupMs = 0;
    let queueBufferFetchMs = 0;
    let queueProgressUpdateMs = 0;
    let nextCard: PracticeCardDTO | null = null;
    let upcomingCards: PracticeCardDTO[] = [];

    if (cached && cached.userId === userId && cached.deckId === session.deckId) {
      cacheHit = true;
      cached.attemptedWordIds = new Set([...cached.attemptedWordIds, ...attemptedWordIds]);
      cached.updatedAt = Date.now();

      if (cached.bufferWarmPromise && cached.cards.length === 0) {
        await cached.bufferWarmPromise;
      }

      attemptedWordIds.clear();
      for (const attemptedWordId of cached.attemptedWordIds) attemptedWordIds.add(attemptedWordId);

      nextCard = takeNextCachedCard(cached, attemptedWordIds);
      if (nextCard) {
        upcomingCards = peekUpcomingCachedCards(
          cached,
          new Set([...attemptedWordIds, nextCard.wordId]),
        );
      }
    }

    if (!nextCard) {
      const progressLookup = await measureAsync(async () => await getPracticeQueueProgress(userId, session.deckId));
      queueProgressLookupMs = progressLookup.durationMs;
      const bufferFetch = await measureAsync(async () =>
        await listQueuedPracticeCards(
          userId,
          session.deckId,
          cached?.nextCoverageCursorPosition ??
            progressLookup.value?.coverageCursorPosition ??
            0,
          PRACTICE_SESSION_BUFFER_SIZE,
          [...attemptedWordIds],
        ),
      );
      queueBufferFetchMs = bufferFetch.durationMs;
      nextCard = bufferFetch.value.cards[0] ?? null;
      const remainingCardsBuffer = bufferFetch.value.cards.slice(1);
      const progressUpdate = await measureAsync(async () =>
        await upsertPracticeQueueProgress(userId, session.deckId, bufferFetch.value.nextCoverageCursorPosition),
      );
      queueProgressUpdateMs = progressUpdate.durationMs;

      practiceSessionCache.set(sessionId, {
        userId,
        deckId: session.deckId,
        cards: remainingCardsBuffer,
        attemptedWordIds,
        nextCoverageCursorPosition: bufferFetch.value.nextCoverageCursorPosition,
        bufferBuiltAt: Date.now(),
        updatedAt: Date.now(),
      });
      upcomingCards = remainingCardsBuffer.slice(0, PRACTICE_TTS_PREFETCH_WINDOW);
    }

    if (!nextCard) {
      practiceSessionCache.delete(sessionId);
    }

    tracePractice({
      event: "submit_practice_card",
      userId,
      sessionId,
      deckId: session.deckId,
      wordId,
      totalMs: Date.now() - overallStartedAt,
      durationMs: Date.now() - overallStartedAt,
      sessionLookupMs: sessionLookup.durationMs,
      wordLookupMs: wordLookup.durationMs,
      inDeckCheckMs: inDeckCheck.durationMs,
      userLookupMs: userLookup.durationMs,
      statsLookupMs: statsLookup.durationMs,
      attemptMutationMs: attemptMutation.durationMs,
      upsertStatsMutationMs: upsertStatsMutation.durationMs,
      updateQueueStatsMutationMs: updateQueueStatsMutation.durationMs,
      queueProgressLookupMs,
      queueBufferWarmMs: queueBufferFetchMs,
      queueProgressUpdateMs,
      cacheHit,
      cachedBufferCards: cached?.cards.length ?? 0,
      attemptedWordIds: attemptedWordIds.size,
      sessionCapped,
      returnedNextCard: nextCard?.wordId ?? null,
    });

    return {
      accepted: true,
      scores: { shape, typing, listening },
      nextDueAt: new Date(nextDueAt(next)).toISOString(),
      nextCard,
      upcomingCards,
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

  async getPracticeSessionDetails(userId: string, sessionId: string) {
    const session = (await convex.query("practice:getSessionById", { sessionId })) as ConvexPracticeSession | null;
    if (!session) throw new RepositoryError("Session not found", 404);
    if (session.userId !== userId) throw new RepositoryError("Forbidden", 403);

    const [deck, attempts] = await Promise.all([
      convex.query("decks:getDeckById", { deckId: session.deckId }),
      convex.query("practice:listAttemptsBySession", { sessionId }),
    ]) as [
      ConvexDeck | null,
      Array<{
        _id: string;
        wordId: string;
        shapeScore: number;
        typingScore: number;
        listeningScore: number;
        typingMs: number;
        submittedAt: number;
      }>,
    ];

    const words = await Promise.all(attempts.map((attempt) => convex.query("practice:getWordById", { wordId: attempt.wordId }))) as Array<ConvexWord | null>;

    const durationSeconds = Math.max(
      0,
      Math.round(((session.finishedAt ?? Date.now()) - session.startedAt) / 1000),
    );
    const count = attempts.length;
    const avg = (key: "shapeScore" | "typingScore" | "listeningScore") =>
      count === 0 ? 0 : Math.round(attempts.reduce((acc, item) => acc + item[key], 0) / count);

    return {
      sessionId: session._id,
      deckId: session.deckId,
      deckName: deck?.name ?? null,
      language: deck?.language ?? null,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt ?? null,
      cardsCompleted: session.cardsCompleted,
      durationSeconds,
      avgShapeScore: avg("shapeScore"),
      avgTypingScore: avg("typingScore"),
      avgListeningScore: avg("listeningScore"),
      attempts: attempts.map((attempt, index) => ({
        attemptId: attempt._id,
        wordId: attempt.wordId,
        target: words[index]?.target ?? "",
        meaning: words[index]?.meaning ?? "",
        reading: words[index]?.reading,
        romanization: words[index]?.romanization,
        shapeScore: attempt.shapeScore,
        typingScore: attempt.typingScore,
        listeningScore: attempt.listeningScore,
        typingMs: attempt.typingMs,
        submittedAt: attempt.submittedAt,
      })),
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
