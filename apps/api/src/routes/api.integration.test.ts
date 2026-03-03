import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repository } from "../services/repository";
import { RepositoryError } from "../services/repository";
import { buildServer } from "../server";
import { createInMemoryMagicTokenStore, issueAccessToken } from "../lib/auth";
import type { Mailer } from "../lib/mailer";
import type { TtsService } from "../lib/tts";
import { DefaultThemes, PRACTICE_SESSION_CARD_CAP_DEFAULT } from "@inko/shared";

function makeRepositoryMock(): Repository {
  return {
    getOrCreateUser: vi.fn(async (email: string) => ({
      id: "user_1",
      email,
      displayName: "user",
      themeMode: "dark" as const,
      typingMode: "language_specific" as const,
      ttsEnabled: true,
      canModerateCommunity: true,
      themes: DefaultThemes,
      createdAt: Date.now(),
    })),
    getUserById: vi.fn(async (userId: string) => ({
      id: userId,
      email: "user@example.com",
      displayName: "user",
      themeMode: "dark" as const,
      typingMode: "language_specific" as const,
      ttsEnabled: true,
      canModerateCommunity: true,
      themes: DefaultThemes,
      createdAt: Date.now(),
    })),
    updateUserProfile: vi.fn(async (userId: string, input) => ({
      id: userId,
      email: "user@example.com",
      displayName: input.displayName,
      themeMode: input.themeMode,
      typingMode: input.typingMode,
      ttsEnabled: input.ttsEnabled,
      canModerateCommunity: true,
      themes: input.themes,
      createdAt: Date.now(),
    })),
    updateUserPreferences: vi.fn(async (_userId: string, input) => ({
      id: "user_1",
      email: "user@example.com",
      displayName: "user",
      themeMode: "dark" as const,
      typingMode: "language_specific" as const,
      ttsEnabled: input.ttsEnabled,
      canModerateCommunity: true,
      themes: DefaultThemes,
      createdAt: Date.now(),
    })),
    listDecks: vi.fn(async () => []),
    createDeck: vi.fn(async () => ({
      id: "deck_1",
      userId: "user_1",
      name: "Core N5",
      language: "ja",
      archived: false,
      ttsEnabled: true,
      ttsVoice: "ja-JP-NanamiNeural",
      ttsRate: "default" as const,
      createdAt: Date.now(),
    })),
    updateDeck: vi.fn(async (_userId: string, _deckId: string, input) => ({
      id: "deck_1",
      userId: "user_1",
      name: input.name ?? "Core N5",
      language: input.language ?? "ja",
      archived: input.archived ?? false,
      ttsEnabled: input.ttsEnabled ?? true,
      ttsVoice: input.ttsVoice ?? (input.language === "fr" ? "fr-FR-DeniseNeural" : "ja-JP-NanamiNeural"),
      ttsRate: input.ttsRate ?? "default",
      createdAt: Date.now(),
    })),
    listDeckWordsPage: vi.fn(async () => ({
      words: [],
      nextCursor: null,
      isDone: true,
      totalCount: 0,
    })),
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
    getWordById: vi.fn(async () => ({
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
      ttsEnabled: true,
      ttsVoice: "ja-JP-NanamiNeural",
      ttsRate: "default" as const,
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
    listPublishedCommunityDecks: vi.fn(async () => [
      {
        id: "community_1",
        slug: "jlpt-n5-verbs",
        title: "JLPT N5 Verbs",
        summary: "Starter verbs",
        language: "ja" as const,
        difficulty: "Beginner" as const,
        authorName: "moderator@example.com",
        downloads: 10,
        rating: 4.8,
        cardCount: 12,
        updatedAt: Date.now(),
        tags: ["starter"],
      },
    ]),
    getPublishedCommunityDeckBySlug: vi.fn(async (slug: string) => ({
      id: "community_1",
      slug,
      title: "JLPT N5 Verbs",
      summary: "Starter verbs",
      description: "Deck description",
      language: "ja" as const,
      difficulty: "Beginner" as const,
      authorName: "moderator@example.com",
      downloads: 10,
      rating: 4.8,
      ratingCount: 12,
      cardCount: 12,
      updatedAt: Date.now(),
      tags: ["starter"],
      noteTypes: [{ name: "Basic", fields: ["Expression", "Meaning"] }],
      words: [{ target: "食べる", meaning: "to eat", tags: ["starter"] }],
      comments: [],
    })),
    rateCommunityDeck: vi.fn(async (_userId: string, slug: string, input) => ({
      id: "community_1",
      slug,
      title: "JLPT N5 Verbs",
      summary: "Starter verbs",
      description: "Deck description",
      language: "ja" as const,
      difficulty: "Beginner" as const,
      authorName: "moderator@example.com",
      downloads: 10,
      rating: input.rating,
      ratingCount: 13,
      viewerRating: input.rating,
      cardCount: 12,
      updatedAt: Date.now(),
      tags: ["starter"],
      noteTypes: [{ name: "Basic", fields: ["Expression", "Meaning"] }],
      words: [{ target: "食べる", meaning: "to eat", tags: ["starter"] }],
      comments: [],
    })),
    addCommunityDeckComment: vi.fn(async (userId: string, slug: string, input) => ({
      id: "community_1",
      slug,
      title: "JLPT N5 Verbs",
      summary: "Starter verbs",
      description: "Deck description",
      language: "ja" as const,
      difficulty: "Beginner" as const,
      authorName: "moderator@example.com",
      downloads: 10,
      rating: 4.8,
      ratingCount: 12,
      viewerRating: 5,
      cardCount: 12,
      updatedAt: Date.now(),
      tags: ["starter"],
      noteTypes: [{ name: "Basic", fields: ["Expression", "Meaning"] }],
      words: [{ target: "食べる", meaning: "to eat", tags: ["starter"] }],
      comments: [
        {
          id: "comment_1",
          userId,
          authorName: "user",
          body: input.body,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
    })),
    deleteCommunityDeckComment: vi.fn(async (_userId: string, slug: string, _commentId: string) => ({
      id: "community_1",
      slug,
      title: "JLPT N5 Verbs",
      summary: "Starter verbs",
      description: "Deck description",
      language: "ja" as const,
      difficulty: "Beginner" as const,
      authorName: "moderator@example.com",
      downloads: 10,
      rating: 4.8,
      ratingCount: 12,
      viewerRating: 5,
      cardCount: 12,
      updatedAt: Date.now(),
      tags: ["starter"],
      noteTypes: [{ name: "Basic", fields: ["Expression", "Meaning"] }],
      words: [{ target: "食べる", meaning: "to eat", tags: ["starter"] }],
      comments: [],
    })),
    createCommunityDeckSubmission: vi.fn(async (userId: string, input) => ({
      id: "submission_1",
      submitterUserId: userId,
      submitterEmail: "user@example.com",
      title: input.title,
      summary: input.summary,
      description: input.description,
      language: input.language,
      difficulty: input.difficulty,
      sourceKind: input.sourceKind,
      sourceName: input.sourceName,
      cardCount: input.words.length,
      tags: input.tags,
      noteTypes: input.noteTypes,
      sampleWords: input.words.slice(0, 8),
      status: "pending" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })),
    listMyCommunityDeckSubmissions: vi.fn(async () => []),
    deleteMyCommunityDeckSubmission: vi.fn(async () => ({ ok: true })),
    listCommunityDeckSubmissions: vi.fn(async () => []),
    reviewCommunityDeckSubmission: vi.fn(async (_userId: string, submissionId: string, input) => ({
      id: submissionId,
      submitterUserId: "user_1",
      submitterEmail: "user@example.com",
      title: "Submitted deck",
      summary: "Starter verbs",
      description: "Deck description",
      language: "ja" as const,
      difficulty: "Beginner" as const,
      sourceKind: "apkg" as const,
      sourceName: "starter.apkg",
      cardCount: 2,
      tags: ["starter"],
      noteTypes: [{ name: "Basic", fields: ["Expression", "Meaning"] }],
      sampleWords: [{ target: "食べる", meaning: "to eat", tags: ["starter"] }],
      status: input.status,
      moderationNotes: input.moderationNotes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })),
  } as unknown as Repository;
}

describe("API integration", () => {
  let repo: Repository;
  let mailer: Mailer;
  let sendMagicLink: ReturnType<typeof vi.fn>;
  let tts: TtsService;
  let synthesizeWordAudio: ReturnType<typeof vi.fn>;
  let magicTokenStore: ReturnType<typeof createInMemoryMagicTokenStore>;

  beforeEach(() => {
    repo = makeRepositoryMock();
    sendMagicLink = vi.fn(async () => {});
    synthesizeWordAudio = vi.fn(async () => ({
      audio: Buffer.from("fake-mp3"),
      contentType: "audio/mpeg",
      fileName: "word.mp3",
      audioUrl: "https://convex.example/word.mp3",
    }));
    tts = {
      synthesizeWordAudio,
    };
    mailer = {
      kind: "log",
      sendMagicLink,
    };
    magicTokenStore = createInMemoryMagicTokenStore();
  });

  it("supports auth verify and /api/me", async () => {
    const app = await buildServer({ repository: repo, mailer, magicTokenStore, skipMigrations: true });

    const email = "user@example.com";
    const token = await magicTokenStore.create(email);

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

  it("exchanges the temporary oauth cookie for a bearer token", async () => {
    const app = await buildServer({ repository: repo, mailer, magicTokenStore, skipMigrations: true });
    const accessToken = await issueAccessToken("user_1", "user@example.com");

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/oauth/exchange",
      headers: {
        cookie: `inko_oauth_session=${encodeURIComponent(accessToken)}`,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBe(accessToken);
    expect(res.json().user.id).toBe("user_1");
    expect(res.headers["set-cookie"]).toContain("inko_oauth_session=;");

    await app.close();
  });

  it("updates profile name and theme preferences via /api/me", async () => {
    const app = await buildServer({ repository: repo, mailer, magicTokenStore, skipMigrations: true });
    const accessToken = await issueAccessToken("user_1", "user@example.com");

    const res = await app.inject({
      method: "PATCH",
      url: "/api/me",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        displayName: "Yukai",
        themeMode: "light",
        ttsEnabled: false,
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
    expect(res.json().ttsEnabled).toBe(false);
    expect(res.json().themes.light.accentOrange).toBe("#ff9900");

    await app.close();
  });

  it("supports deck-word-practice flow via authenticated API", async () => {
    const app = await buildServer({ repository: repo, mailer, ttsService: tts, magicTokenStore, skipMigrations: true });
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

    const updateDeckRes = await app.inject({
      method: "PATCH",
      url: "/api/decks/deck_1",
      headers: auth,
      payload: { name: "Core FR", language: "fr" },
    });
    expect(updateDeckRes.statusCode).toBe(200);
    expect(updateDeckRes.json().name).toBe("Core FR");
    expect(updateDeckRes.json().language).toBe("fr");
    expect(updateDeckRes.json().ttsVoice).toBe("fr-FR-DeniseNeural");

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

    const listWordsPageRes = await app.inject({
      method: "GET",
      url: "/api/decks/deck_1/words/page?limit=100",
      headers: auth,
    });
    expect(listWordsPageRes.statusCode).toBe(200);
    expect(listWordsPageRes.json()).toEqual({
      words: [],
      nextCursor: null,
      isDone: true,
      totalCount: 0,
    });

    const startRes = await app.inject({
      method: "POST",
      url: "/api/practice/session/start",
      headers: auth,
      payload: { deckId: "deck_1" },
    });
    expect(startRes.statusCode).toBe(200);
    expect(startRes.json().sessionTargetCards).toBe(PRACTICE_SESSION_CARD_CAP_DEFAULT);
    expect(startRes.json().cardsCompleted).toBe(0);
    expect(startRes.json().ttsEnabled).toBe(true);
    expect(startRes.json().ttsVoice).toBe("ja-JP-NanamiNeural");
    expect(startRes.json().ttsRate).toBe("default");

    const ttsRes = await app.inject({
      method: "GET",
      url: "/api/words/word_1/tts?deckId=deck_1",
      headers: auth,
    });
    expect(ttsRes.statusCode).toBe(200);
    expect(ttsRes.headers["content-type"]).toContain("audio/mpeg");
    expect(ttsRes.body).toBe("fake-mp3");
    expect(synthesizeWordAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        deckId: "deck_1",
        wordId: "word_1",
        voice: undefined,
        rate: undefined,
      }),
    );

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

  it("supports community ratings and comments for authenticated users", async () => {
    const app = await buildServer({ repository: repo, mailer, magicTokenStore, skipMigrations: true });
    const accessToken = await issueAccessToken("user_1", "user@example.com");
    const auth = { authorization: `Bearer ${accessToken}` };

    const rateRes = await app.inject({
      method: "POST",
      url: "/api/community/decks/jlpt-n5-verbs/rating",
      headers: auth,
      payload: { rating: 5 },
    });
    expect(rateRes.statusCode).toBe(200);
    expect(rateRes.json().viewerRating).toBe(5);
    expect(rateRes.json().ratingCount).toBe(13);

    const commentRes = await app.inject({
      method: "POST",
      url: "/api/community/decks/jlpt-n5-verbs/comments",
      headers: auth,
      payload: { body: "Great starter deck." },
    });
    expect(commentRes.statusCode).toBe(200);
    expect(commentRes.json().comments).toHaveLength(1);
    expect(commentRes.json().comments[0].body).toBe("Great starter deck.");

    const deleteCommentRes = await app.inject({
      method: "DELETE",
      url: "/api/community/decks/jlpt-n5-verbs/comments/comment_1",
      headers: auth,
    });
    expect(deleteCommentRes.statusCode).toBe(200);
    expect(deleteCommentRes.json().comments).toHaveLength(0);

    await app.close();
  });

  it("rejects access to protected endpoints without bearer token", async () => {
    const app = await buildServer({ repository: repo, mailer, ttsService: tts, magicTokenStore, skipMigrations: true });

    const protectedRequests = [
      app.inject({ method: "GET", url: "/api/me" }),
      app.inject({ method: "GET", url: "/api/decks" }),
      app.inject({ method: "POST", url: "/api/practice/session/start", payload: { deckId: "deck_1" } }),
      app.inject({ method: "GET", url: "/api/dashboard/summary" }),
      app.inject({ method: "GET", url: "/api/dashboard/stats" }),
      app.inject({ method: "GET", url: "/api/dashboard/recent-sessions" }),
      app.inject({ method: "GET", url: "/api/words/word_1/tts" }),
    ];

    const responses = await Promise.all(protectedRequests);
    for (const response of responses) {
      expect(response.statusCode).toBe(401);
      expect(response.json().message).toContain("Missing bearer token");
    }

    await app.close();
  });

  it("rejects protected endpoints with invalid bearer token", async () => {
    const app = await buildServer({ repository: repo, mailer, ttsService: tts, magicTokenStore, skipMigrations: true });

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
    const app = await buildServer({ repository: repo, mailer, ttsService: tts, magicTokenStore, skipMigrations: true });
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
    repo.listDeckWordsPage = vi.fn(async () => {
      throw new RepositoryError("Forbidden", 403);
    });

    const app = await buildServer({ repository: repo, mailer, ttsService: tts, magicTokenStore, skipMigrations: true });
    const accessToken = await issueAccessToken("user_1", "user@example.com");

    const res = await app.inject({
      method: "GET",
      url: "/api/decks/deck_other/words/page?limit=100",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it("sends magic link email and returns devToken with log mailer", async () => {
    const app = await buildServer({ repository: repo, mailer, ttsService: tts, magicTokenStore, skipMigrations: true });

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

  it("serves published community deck endpoints", async () => {
    const app = await buildServer({ repository: repo, mailer, ttsService: tts, magicTokenStore, skipMigrations: true });

    const listRes = await app.inject({
      method: "GET",
      url: "/api/community/decks?language=ja&search=verbs",
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()[0].slug).toBe("jlpt-n5-verbs");

    const detailRes = await app.inject({
      method: "GET",
      url: "/api/community/decks/jlpt-n5-verbs",
    });
    expect(detailRes.statusCode).toBe(200);
    expect(detailRes.json().noteTypes[0].name).toBe("Basic");

    await app.close();
  });

  it("supports authenticated community submission and moderation routes", async () => {
    const app = await buildServer({ repository: repo, mailer, ttsService: tts, magicTokenStore, skipMigrations: true });
    const accessToken = await issueAccessToken("user_1", "user@example.com");
    const auth = { authorization: `Bearer ${accessToken}` };

    const createRes = await app.inject({
      method: "POST",
      url: "/api/community/submissions",
      headers: auth,
      payload: {
        title: "Submitted deck",
        summary: "Starter verbs",
        description: "Deck description",
        language: "ja",
        difficulty: "Beginner",
        sourceKind: "apkg",
        sourceName: "starter.apkg",
        tags: ["starter"],
        noteTypes: [{ name: "Basic", fields: ["Expression", "Meaning"] }],
        words: [
          { target: "食べる", meaning: "to eat", tags: ["starter"] },
          { target: "飲む", meaning: "to drink", tags: ["starter"] },
        ],
      },
    });
    expect(createRes.statusCode).toBe(200);
    expect(createRes.json().status).toBe("pending");

    const mineRes = await app.inject({
      method: "GET",
      url: "/api/community/submissions/mine",
      headers: auth,
    });
    expect(mineRes.statusCode).toBe(200);

    const deleteRes = await app.inject({
      method: "DELETE",
      url: "/api/community/submissions/submission_1",
      headers: auth,
    });
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().ok).toBe(true);

    const listRes = await app.inject({
      method: "GET",
      url: "/api/community/submissions?status=pending",
      headers: auth,
    });
    expect(listRes.statusCode).toBe(200);

    const reviewRes = await app.inject({
      method: "POST",
      url: "/api/community/submissions/submission_1/review",
      headers: auth,
      payload: {
        status: "approved",
        moderationNotes: "Looks good",
        slug: "submitted-deck",
      },
    });
    expect(reviewRes.statusCode).toBe(200);
    expect(reviewRes.json().status).toBe("approved");

    await app.close();
  });
});
