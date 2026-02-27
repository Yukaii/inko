import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repository } from "../services/repository";
import { RepositoryError } from "../services/repository";
import { buildServer } from "../server";
import { createMagicToken, issueAccessToken } from "../lib/auth";
import type { Mailer } from "../lib/mailer";
import { DefaultThemes, PRACTICE_SESSION_CARD_CAP_DEFAULT } from "@inko/shared";

function makeRepositoryMock(): Repository {
  return {
    getOrCreateUser: vi.fn(async (email: string) => ({
      id: "user_1",
      email,
      displayName: "user",
      themeMode: "dark" as const,
      typingMode: "language_specific" as const,
      themes: DefaultThemes,
      createdAt: Date.now(),
    })),
    getUserById: vi.fn(async (userId: string) => ({
      id: userId,
      email: "user@example.com",
      displayName: "user",
      themeMode: "dark" as const,
      typingMode: "language_specific" as const,
      themes: DefaultThemes,
      createdAt: Date.now(),
    })),
    updateUserProfile: vi.fn(async (userId: string, input) => ({
      id: userId,
      email: "user@example.com",
      displayName: input.displayName,
      themeMode: input.themeMode,
      typingMode: input.typingMode,
      themes: input.themes,
      createdAt: Date.now(),
    })),
    listDecks: vi.fn(async () => []),
    createDeck: vi.fn(async () => ({
      id: "deck_1",
      userId: "user_1",
      name: "Core N5",
      language: "ja",
      archived: false,
      createdAt: Date.now(),
    })),
    updateDeck: vi.fn(async () => ({
      id: "deck_1",
      userId: "user_1",
      name: "Core N5",
      language: "ja",
      archived: false,
      createdAt: Date.now(),
    })),
    listDeckWords: vi.fn(async () => []),
    createWord: vi.fn(async () => ({
      id: "word_1",
      userId: "user_1",
      language: "ja",
      target: "勉強",
      reading: "べんきょう",
      romanization: "benkyou",
      meaning: "study",
      example: "毎日勉強します。",
      audioUrl: undefined,
      tags: ["n5"],
    })),
    createWordsBatch: vi.fn(async (_userId: string, _deckId: string, input: { words: Array<{ target: string; meaning: string }> }) =>
      input.words.map((word, index) => ({
        id: `word_${index + 1}`,
        userId: "user_1",
        language: "ja",
        target: word.target,
        reading: undefined,
        romanization: undefined,
        meaning: word.meaning,
        example: undefined,
        audioUrl: undefined,
        tags: [],
      })),
    ),
    updateWord: vi.fn(async () => ({
      id: "word_1",
      userId: "user_1",
      language: "ja",
      target: "勉強",
      reading: "べんきょう",
      romanization: "benkyou",
      meaning: "study",
      example: "毎日勉強します。",
      audioUrl: undefined,
      tags: ["n5"],
    })),
    deleteWord: vi.fn(async () => ({ ok: true })),
    deleteWordsBatch: vi.fn(async (_userId: string, _deckId: string, input: { wordIds: string[] }) => ({
      deleted: input.wordIds.length,
      failedWordIds: [],
    })),
    startPracticeSession: vi.fn(async () => ({
      sessionId: "session_1",
      typingMode: "language_specific" as const,
      sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
      cardsCompleted: 0,
      remainingCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
      card: {
        wordId: "word_1",
        deckId: "deck_1",
        language: "ja" as const,
        target: "勉強",
        reading: "べんきょう",
        romanization: "benkyou",
        meaning: "study",
      },
    })),
    submitPracticeCard: vi.fn(async () => ({
      accepted: true,
      scores: { shape: 100, typing: 90, listening: 80 },
      nextDueAt: new Date().toISOString(),
      sessionTargetCards: PRACTICE_SESSION_CARD_CAP_DEFAULT,
      cardsCompleted: 1,
      remainingCards: PRACTICE_SESSION_CARD_CAP_DEFAULT - 1,
      sessionCapped: false,
    })),
    finishPracticeSession: vi.fn(async () => ({
      sessionId: "session_1",
      cardsCompleted: 1,
      avgShapeScore: 100,
      avgTypingScore: 90,
      avgListeningScore: 80,
      durationSeconds: 20,
    })),
    dashboardSummary: vi.fn(async () => ({
      totalWordsLearned: 1,
      wordsDueToday: 1,
      learningStreak: 1,
      sessionTimeSeconds: 20,
      recentSessions: [],
    })),
    dashboardStats: vi.fn(async () => ({
      totalWordsLearned: 1,
      wordsDueToday: 1,
      learningStreak: 1,
      sessionTimeSeconds: 20,
    })),
    dashboardRecentSessions: vi.fn(async () => ({
      recentSessions: [],
    })),
  } as unknown as Repository;
}

describe("API integration", () => {
  let repo: Repository;
  let mailer: Mailer;
  let sendMagicLink: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    repo = makeRepositoryMock();
    sendMagicLink = vi.fn(async () => {});
    mailer = {
      kind: "log",
      sendMagicLink,
    };
  });

  it("supports auth verify and /api/me", async () => {
    const app = await buildServer({ repository: repo, mailer });

    const email = "user@example.com";
    const token = createMagicToken(email);

    const verifyRes = await app.inject({
      method: "POST",
      url: "/api/auth/magic-link/verify",
      payload: { token },
    });

    expect(verifyRes.statusCode).toBe(200);
    const body = verifyRes.json();
    expect(body.user.email).toBe(email);
    expect(body.accessToken).toBeTypeOf("string");

    const meRes = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: `Bearer ${body.accessToken}` },
    });

    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().id).toBe("user_1");
    expect(meRes.json().displayName).toBe("user");

    await app.close();
  });

  it("updates profile name and theme preferences via /api/me", async () => {
    const app = await buildServer({ repository: repo, mailer });
    const accessToken = await issueAccessToken("user_1", "user@example.com");

    const res = await app.inject({
      method: "PATCH",
      url: "/api/me",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        displayName: "Yukai",
        themeMode: "light",
        themes: {
          ...DefaultThemes,
          light: {
            ...DefaultThemes.light,
            accentOrange: "#ff9900",
          },
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().displayName).toBe("Yukai");
    expect(res.json().themeMode).toBe("light");
    expect(res.json().themes.light.accentOrange).toBe("#ff9900");

    await app.close();
  });

  it("supports deck-word-practice flow via authenticated API", async () => {
    const app = await buildServer({ repository: repo, mailer });
    const accessToken = await issueAccessToken("user_1", "user@example.com");
    const auth = { authorization: `Bearer ${accessToken}` };

    const createDeckRes = await app.inject({
      method: "POST",
      url: "/api/decks",
      headers: auth,
      payload: { name: "Core N5", language: "ja" },
    });
    expect(createDeckRes.statusCode).toBe(200);

    const listDeckRes = await app.inject({
      method: "GET",
      url: "/api/decks",
      headers: auth,
    });
    expect(listDeckRes.statusCode).toBe(200);

    const createWordRes = await app.inject({
      method: "POST",
      url: "/api/decks/deck_1/words",
      headers: auth,
      payload: {
        target: "勉強",
        reading: "べんきょう",
        romanization: "benkyou",
        meaning: "study",
      },
    });
    expect(createWordRes.statusCode).toBe(200);

    const createBatchRes = await app.inject({
      method: "POST",
      url: "/api/decks/deck_1/words/batch",
      headers: auth,
      payload: {
        words: [
          { target: "食べる", meaning: "to eat" },
          { target: "飲む", meaning: "to drink" },
        ],
      },
    });
    expect(createBatchRes.statusCode).toBe(200);
    expect(createBatchRes.json().created).toBe(2);

    const deleteBatchRes = await app.inject({
      method: "POST",
      url: "/api/decks/deck_1/words/batch-delete",
      headers: auth,
      payload: {
        wordIds: ["word_1", "word_2"],
      },
    });
    expect(deleteBatchRes.statusCode).toBe(200);
    expect(deleteBatchRes.json().deleted).toBe(2);

    const listWordsRes = await app.inject({
      method: "GET",
      url: "/api/decks/deck_1/words",
      headers: auth,
    });
    expect(listWordsRes.statusCode).toBe(200);

    const startRes = await app.inject({
      method: "POST",
      url: "/api/practice/session/start",
      headers: auth,
      payload: { deckId: "deck_1" },
    });
    expect(startRes.statusCode).toBe(200);
    expect(startRes.json().sessionTargetCards).toBe(PRACTICE_SESSION_CARD_CAP_DEFAULT);
    expect(startRes.json().cardsCompleted).toBe(0);

    const submitRes = await app.inject({
      method: "POST",
      url: "/api/practice/session/session_1/card/submit?wordId=word_1",
      headers: auth,
      payload: {
        handwritingCompleted: true,
        typingInput: "勉強",
        typingMs: 1800,
        audioPlayed: true,
        listeningConfidence: 4,
      },
    });
    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().accepted).toBe(true);
    expect(submitRes.json().cardsCompleted).toBe(1);
    expect(submitRes.json().sessionTargetCards).toBe(PRACTICE_SESSION_CARD_CAP_DEFAULT);

    const finishRes = await app.inject({
      method: "POST",
      url: "/api/practice/session/session_1/finish",
      headers: auth,
    });
    expect(finishRes.statusCode).toBe(200);

    const dashboardRes = await app.inject({
      method: "GET",
      url: "/api/dashboard/summary",
      headers: auth,
    });
    expect(dashboardRes.statusCode).toBe(200);
    const dashboardStatsRes = await app.inject({
      method: "GET",
      url: "/api/dashboard/stats",
      headers: auth,
    });
    expect(dashboardStatsRes.statusCode).toBe(200);
    const dashboardRecentRes = await app.inject({
      method: "GET",
      url: "/api/dashboard/recent-sessions",
      headers: auth,
    });
    expect(dashboardRecentRes.statusCode).toBe(200);

    await app.close();
  });

  it("rejects access to protected endpoints without bearer token", async () => {
    const app = await buildServer({ repository: repo, mailer });

    const protectedRequests = [
      app.inject({ method: "GET", url: "/api/me" }),
      app.inject({ method: "GET", url: "/api/decks" }),
      app.inject({ method: "POST", url: "/api/practice/session/start", payload: { deckId: "deck_1" } }),
      app.inject({ method: "GET", url: "/api/dashboard/summary" }),
      app.inject({ method: "GET", url: "/api/dashboard/stats" }),
      app.inject({ method: "GET", url: "/api/dashboard/recent-sessions" }),
    ];

    const responses = await Promise.all(protectedRequests);
    for (const response of responses) {
      expect(response.statusCode).toBe(401);
      expect(response.json().message).toContain("Missing bearer token");
    }

    await app.close();
  });

  it("rejects protected endpoints with invalid bearer token", async () => {
    const app = await buildServer({ repository: repo, mailer });

    const res = await app.inject({
      method: "GET",
      url: "/api/decks",
      headers: { authorization: "Bearer invalid.token.value" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().message).toContain("Invalid token");

    await app.close();
  });

  it("returns bad request when practice submit is missing wordId query param", async () => {
    const app = await buildServer({ repository: repo, mailer });
    const accessToken = await issueAccessToken("user_1", "user@example.com");

    const res = await app.inject({
      method: "POST",
      url: "/api/practice/session/session_1/card/submit",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        handwritingCompleted: true,
        typingInput: "勉強",
        typingMs: 1800,
        audioPlayed: true,
        listeningConfidence: 4,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("wordId query param is required");

    await app.close();
  });

  it("maps repository forbidden errors to 403", async () => {
    repo.listDeckWords = vi.fn(async () => {
      throw new RepositoryError("Forbidden", 403);
    });

    const app = await buildServer({ repository: repo, mailer });
    const accessToken = await issueAccessToken("user_1", "user@example.com");

    const res = await app.inject({
      method: "GET",
      url: "/api/decks/deck_other/words",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it("sends magic link email and returns devToken with log mailer", async () => {
    const app = await buildServer({ repository: repo, mailer });

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/magic-link/request",
      payload: { email: "user@example.com" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.devToken).toBeTypeOf("string");
    expect(sendMagicLink).toHaveBeenCalledOnce();
    expect(sendMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
        token: body.devToken,
      }),
    );

    await app.close();
  });
});
