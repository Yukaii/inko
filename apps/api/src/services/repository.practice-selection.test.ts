import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, mutationMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  mutationMock: vi.fn(),
}));

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

function makeCard(wordId: string) {
  return {
    wordId,
    deckId: "deck_1",
    language: "ja" as const,
    target: wordId,
    meaning: wordId,
  };
}

describe("repository practice queue start", () => {
  beforeEach(() => {
    queryMock.mockReset();
    mutationMock.mockReset();
  });

  it("starts sessions from the queue and warms the remaining buffer", async () => {
    const progressResponses = [
      null,
      {
        _id: "progress_1",
        userId: "user_1",
        deckId: "deck_1",
        coverageCursorPosition: 201,
        updatedAt: 10,
      },
    ];

    const firstCardResponses = [
      {
        card: makeCard("word_1"),
        nextCoverageCursorPosition: 101,
      },
      {
        card: makeCard("word_3"),
        nextCoverageCursorPosition: 301,
      },
    ];

    const bufferResponses = [
      {
        cards: [makeCard("word_2"), makeCard("word_4")],
        nextCoverageCursorPosition: 201,
      },
      {
        cards: [makeCard("word_5")],
        nextCoverageCursorPosition: 351,
      },
    ];

    queryMock.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      switch (name) {
        case "decks:getDeckById":
          return makeDeck();
        case "practiceQueue:getProgress":
          return progressResponses.shift() ?? null;
        case "practiceQueue:getNextCard":
          return firstCardResponses.shift();
        case "practiceQueue:listSessionBuffer":
          return bufferResponses.shift();
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
        case "practiceQueue:upsertProgress":
          return null;
        default:
          throw new Error(`Unexpected mutation ${name}`);
      }
    });

    const first = await repository.startPracticeSession("user_1", { deckId: "deck_1" });
    await Promise.resolve();
    await Promise.resolve();
    const second = await repository.startPracticeSession("user_1", { deckId: "deck_1" });
    await Promise.resolve();
    await Promise.resolve();

    expect(first.card.wordId).toBe("word_1");
    expect(second.card.wordId).toBe("word_3");

    const firstCardCalls = queryMock.mock.calls.filter(
      ([name]) => name === "practiceQueue:getNextCard",
    );
    expect(firstCardCalls).toHaveLength(2);
    expect(firstCardCalls[0]?.[1]).toMatchObject({ coverageCursorPosition: 0 });
    expect(firstCardCalls[1]?.[1]).toMatchObject({ coverageCursorPosition: 201 });

    const bufferCalls = queryMock.mock.calls.filter(
      ([name]) => name === "practiceQueue:listSessionBuffer",
    );
    expect(bufferCalls).toHaveLength(2);
    expect(bufferCalls[0]?.[1]).toMatchObject({ limit: 49, excludeWordIds: ["word_1"] });

    const progressUpdates = mutationMock.mock.calls.filter(([name]) => name === "practiceQueue:upsertProgress");
    expect(progressUpdates.length).toBeGreaterThanOrEqual(2);
    expect(progressUpdates[0]?.[1]).toMatchObject({ coverageCursorPosition: 101 });
  });
});
