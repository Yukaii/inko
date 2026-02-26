import type {
  CreateDeckInput,
  CreateWordInput,
  StartPracticeSessionInput,
  SubmitPracticeCardInput,
  UpdateDeckInput,
  UpdateWordInput,
} from "@inko/shared";
import {
  defaultWordChannelStats,
  nextDueAt,
  scoreListening,
  scoreShape,
  scoreTyping,
  applyAttempt,
} from "@inko/shared";
import { convex } from "../lib/convex.js";

type ConvexUser = { _id: string; email: string; createdAt: number };
type ConvexDeck = {
  _id: string;
  userId: string;
  name: string;
  language: "ja";
  archived: boolean;
  createdAt: number;
};
type ConvexWord = {
  _id: string;
  userId: string;
  language: "ja";
  target: string;
  reading?: string;
  romanization?: string;
  meaning: string;
  example?: string;
  audioUrl?: string;
  tags: string[];
};

function toUserDTO(user: ConvexUser) {
  return { id: user._id, email: user.email, createdAt: user.createdAt };
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

  async updateDeck(deckId: string, input: UpdateDeckInput) {
    const deck = await convex.mutation("decks:updateDeck", { deckId, ...input });
    if (!deck) throw new Error("Deck not found");
    return toDeckDTO(deck as ConvexDeck);
  },

  async listDeckWords(deckId: string) {
    const words = (await convex.query("decks:listDeckWords", {
      deckId,
    })) as ConvexWord[];
    return words.map(toWordDTO);
  },

  async createWord(userId: string, deckId: string, input: CreateWordInput) {
    const word = await convex.mutation("decks:createWord", {
      userId,
      deckId,
      ...input,
      tags: input.tags ?? [],
    });
    if (!word) throw new Error("Failed to create word");
    return toWordDTO(word as ConvexWord);
  },

  async updateWord(wordId: string, input: UpdateWordInput) {
    const word = await convex.mutation("decks:updateWord", {
      wordId,
      ...input,
    });

    if (!word) throw new Error("Word not found");
    return toWordDTO(word as ConvexWord);
  },

  async deleteWord(wordId: string) {
    await convex.mutation("decks:deleteWord", { wordId });
    return { ok: true };
  },

  async startPracticeSession(userId: string, input: StartPracticeSessionInput) {
    const session = await convex.mutation("practice:startSession", {
      userId,
      deckId: input.deckId,
    });

    if (!session) throw new Error("Failed to start session");

    const rows = (await convex.query("practice:listDeckWordsWithStats", {
      userId,
      deckId: input.deckId,
    })) as Array<{ word: ConvexWord; stat?: any }>;

    if (rows.length === 0) {
      throw new Error("No words available in deck");
    }

    const now = Date.now();
    const sorted = rows
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

    const selected = sorted[0].word;

    return {
      sessionId: (session as any)._id as string,
      card: {
        wordId: selected._id,
        deckId: input.deckId,
        target: selected.target,
        reading: selected.reading,
        romanization: selected.romanization,
        meaning: selected.meaning,
        example: selected.example,
        audioUrl: selected.audioUrl,
      },
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
      | { _id: string; deckId: string }
      | null;
    if (!session) {
      throw new Error("Session not found");
    }

    const word = (await convex.query("words:getById", { wordId })) as ConvexWord | null;
    if (!word) {
      throw new Error("Word not found for submission");
    }

    const shape = scoreShape(input.handwritingCompleted);
    const typing = scoreTyping(input.typingInput, word.target, word.reading, input.typingMs);
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

    return {
      accepted: true,
      scores: { shape, typing, listening },
      nextDueAt: new Date(nextDueAt(next)).toISOString(),
    };
  },

  async finishPracticeSession(sessionId: string) {
    const session = await convex.mutation("practice:finishSession", { sessionId });
    if (!session) throw new Error("Session not found");

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
