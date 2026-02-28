import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const mutationMock = vi.fn();

vi.mock("../lib/convex", () => ({
  convex: {
    query: queryMock,
    mutation: mutationMock,
  },
}));

import { repository } from "./repository";

function makeDeck() {
  return {
    _id: "deck_1",
    userId: "user_1",
    name: "Core N5",
    language: "ja" as const,
    archived: false,
    createdAt: 1,
  };
}

function makeUser() {
  return {
    _id: "user_1",
    email: "user@example.com",
    createdAt: 1,
  };
}

function makeRow(wordId: string, position: number, strength: number, dueAt: number) {
  return {
    position,
    word: {
      _id: wordId,
      userId: "user_1",
      language: "ja" as const,
      target: wordId,
      meaning: wordId,
      tags: [],
    },
    stat: {
      shapeStrength: strength,
      typingStrength: strength,
      listeningStrength: strength,
      shapeDueAt: dueAt,
      typingDueAt: dueAt,
      listeningDueAt: dueAt,
    },
  };
}

describe("repository practice candidate rotation", () => {
  beforeEach(() => {
    queryMock.mockReset();
    mutationMock.mockReset();
  });

  it("advances the deck window across sessions instead of always restarting from the front", async () => {
    const progressResponses = [
      null,
      {
        _id: "progress_1",
        userId: "user_1",
        deckId: "deck_1",
        nextPosition: 201,
        updatedAt: 10,
      },
    ];

    const candidateWindows = [
      {
        page: [makeRow("word_1", 101, 10, 1000), makeRow("word_2", 102, 20, 2000)],
        nextStartPosition: 201,
      },
      {
        page: [makeRow("word_3", 201, 5, 500), makeRow("word_4", 202, 15, 1500)],
        nextStartPosition: 301,
      },
    ];

    queryMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      switch (name) {
        case "decks:getDeckById":
          return makeDeck();
        case "practice:getDeckPracticeProgress":
          return progressResponses.shift() ?? null;
        case "practice:listDeckWordsWithStatsFromPosition":
          return candidateWindows.shift();
        case "users:getById":
          return makeUser();
        default:
          throw new Error(`Unexpected query ${name} ${JSON.stringify(args)}`);
      }
    });

    mutationMock.mockImplementation(async (name: string) => {
      switch (name) {
        case "practice:startSession":
          return {
            _id: `session_${mutationMock.mock.calls.filter(([callName]) => callName === "practice:startSession").length}`,
            userId: "user_1",
            deckId: "deck_1",
            startedAt: 1,
            cardsCompleted: 0,
            attemptedWordIds: [],
          };
        case "practice:upsertDeckPracticeProgress":
          return null;
        default:
          throw new Error(`Unexpected mutation ${name}`);
      }
    });

    const first = await repository.startPracticeSession("user_1", { deckId: "deck_1" });
    const second = await repository.startPracticeSession("user_1", { deckId: "deck_1" });

    expect(first.card.wordId).toBe("word_1");
    expect(second.card.wordId).toBe("word_3");

    const candidateCalls = queryMock.mock.calls.filter(
      ([name]) => name === "practice:listDeckWordsWithStatsFromPosition",
    );
    expect(candidateCalls).toHaveLength(2);
    expect(candidateCalls[0]?.[1]).toMatchObject({ startPosition: 0, limit: 10 });
    expect(candidateCalls[1]?.[1]).toMatchObject({ startPosition: 201, limit: 10 });

    const progressUpdates = mutationMock.mock.calls.filter(
      ([name]) => name === "practice:upsertDeckPracticeProgress",
    );
    expect(progressUpdates).toHaveLength(2);
    expect(progressUpdates[0]?.[1]).toMatchObject({ nextPosition: 201 });
    expect(progressUpdates[1]?.[1]).toMatchObject({ nextPosition: 301 });
  });
});
