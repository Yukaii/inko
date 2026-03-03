import type {
  CreateCommunityDeckCommentInput,
  CommunityDeckDetailDTO,
  CommunityDeckSubmissionDTO,
  CommunityDeckSummaryDTO,
  CreateCommunityDeckSubmissionInput,
  CreateDeckInput,
  CreateWordsBatchInput,
  CreateWordInput,
  DeckDTO,
  DeleteWordsBatchInput,
  PracticeCardDTO,
  RateCommunityDeckInput,
  ReviewCommunityDeckSubmissionInput,
  SessionSummaryDTO,
  SubmitPracticeCardInput,
  TypingMode,
  UpdatePreferencesInput,
  UpdateProfileInput,
  UpdateDeckInput,
  UpdateWordInput,
  UserDTO,
  WordDTO,
} from "@inko/shared";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

type DashboardSummary = {
  totalWordsLearned: number;
  wordsDueToday: number;
  learningStreak: number;
  sessionTimeSeconds: number;
  recentSessions: Array<{
    sessionId: string;
    deckId: string;
    deckName?: string;
    cardsCompleted: number;
    startedAt: number;
    finishedAt?: number;
  }>;
};

type DashboardStats = Omit<DashboardSummary, "recentSessions"> & {
  totalWordsLearnedCapped?: boolean;
  wordsDueTodayCapped?: boolean;
};

type DashboardRecentSessions = {
  recentSessions: DashboardSummary["recentSessions"];
};

type PracticeSessionDetails = {
  sessionId: string;
  deckId: string;
  deckName: string | null;
  language: string | null;
  startedAt: number;
  finishedAt: number | null;
  cardsCompleted: number;
  durationSeconds: number;
  avgShapeScore: number;
  avgTypingScore: number;
  avgListeningScore: number;
  attempts: Array<{
    attemptId: string;
    wordId: string;
    target: string;
    meaning: string;
    reading?: string;
    romanization?: string;
    shapeScore: number;
    typingScore: number;
    listeningScore: number;
    typingMs: number;
    submittedAt: number;
  }>;
};

type AuthVerifyResponse = { accessToken: string; user: UserDTO };
type StartPracticeResponse = {
  sessionId: string;
  card: PracticeCardDTO;
  upcomingCards?: PracticeCardDTO[];
  typingMode?: TypingMode;
  ttsEnabled?: boolean;
  ttsVoice?: string;
  ttsRate?: "-20%" | "default" | "+20%";
  sessionTargetCards?: number;
  cardsCompleted?: number;
  remainingCards?: number;
};

type SubmitPracticeResponse = {
  accepted: boolean;
  scores: { shape: number; typing: number; listening: number };
  nextDueAt: string;
  nextCard?: PracticeCardDTO | null;
  upcomingCards?: PracticeCardDTO[];
  sessionTargetCards?: number;
  cardsCompleted?: number;
  remainingCards?: number;
  sessionCapped?: boolean;
};

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && init.body !== null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let errorData;
    try {
      errorData = await res.json();
    } catch {
      throw new Error(await res.text() || res.statusText);
    }
    
    const error = new Error(errorData.message || res.statusText) as any;
    error.code = errorData.code;
    error.statusCode = res.status;
    throw error;
  }

  return (await res.json()) as T;
}

async function requestBlob(path: string, init: RequestInit = {}, token?: string): Promise<Blob> {
  const headers = new Headers(init.headers);
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let errorMessage = res.statusText;
    try {
      const errorData = await res.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      errorMessage = await res.text() || errorMessage;
    }

    const error = new Error(errorMessage) as Error & { statusCode?: number };
    error.statusCode = res.status;
    throw error;
  }

  return await res.blob();
}

export const api = {
  requestMagicLink: (email: string) =>
    request<{ ok: boolean; devToken?: string }>("/api/auth/magic-link/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  verifyMagicLink: (token: string) =>
    request<AuthVerifyResponse>("/api/auth/magic-link/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  me: (token: string) => request<UserDTO>("/api/me", {}, token),
  updateMe: (token: string, input: UpdateProfileInput) =>
    request<UserDTO>("/api/me", { method: "PATCH", body: JSON.stringify(input) }, token),
  updatePreferences: (token: string, input: UpdatePreferencesInput) =>
    request<UserDTO>("/api/me/preferences", { method: "PATCH", body: JSON.stringify(input) }, token),
  dashboard: (token: string) => request<DashboardSummary>("/api/dashboard/summary", {}, token),
  dashboardStats: (token: string) => request<DashboardStats>("/api/dashboard/stats", {}, token),
  dashboardRecentSessions: (token: string) =>
    request<DashboardRecentSessions>("/api/dashboard/recent-sessions", {}, token),

  listCommunityDecks: (options?: { language?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (options?.language) params.set("language", options.language);
    if (options?.search) params.set("search", options.search);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<CommunityDeckSummaryDTO[]>(`/api/community/decks${suffix}`);
  },

  getCommunityDeck: (slug: string, token?: string) => request<CommunityDeckDetailDTO>(`/api/community/decks/${slug}`, {}, token),

  rateCommunityDeck: (token: string, slug: string, input: RateCommunityDeckInput) =>
    request<CommunityDeckDetailDTO>(
      `/api/community/decks/${slug}/rating`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),

  addCommunityDeckComment: (token: string, slug: string, input: CreateCommunityDeckCommentInput) =>
    request<CommunityDeckDetailDTO>(
      `/api/community/decks/${slug}/comments`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),

  deleteCommunityDeckComment: (token: string, slug: string, commentId: string) =>
    request<CommunityDeckDetailDTO>(`/api/community/decks/${slug}/comments/${commentId}`, { method: "DELETE" }, token),

  submitCommunityDeck: (token: string, input: CreateCommunityDeckSubmissionInput) =>
    request<CommunityDeckSubmissionDTO>("/api/community/submissions", {
      method: "POST",
      body: JSON.stringify(input),
    }, token),

  listMyCommunitySubmissions: (token: string) =>
    request<CommunityDeckSubmissionDTO[]>("/api/community/submissions/mine", {}, token),

  deleteMyCommunitySubmission: (token: string, submissionId: string) =>
    request<{ ok: boolean }>(`/api/community/submissions/${submissionId}`, { method: "DELETE" }, token),

  listCommunitySubmissions: (token: string, options?: { status?: "pending" | "approved" | "rejected" }) => {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<CommunityDeckSubmissionDTO[]>(`/api/community/submissions${suffix}`, {}, token);
  },

  reviewCommunitySubmission: (token: string, submissionId: string, input: ReviewCommunityDeckSubmissionInput) =>
    request<CommunityDeckSubmissionDTO>(`/api/community/submissions/${submissionId}/review`, {
      method: "POST",
      body: JSON.stringify(input),
    }, token),

  uploadImportedAudio: async (token: string, blob: Blob, filename: string) => {
    const headers = new Headers();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    const formData = new FormData();
    formData.append("file", blob, filename);

    const res = await fetch(`${API_BASE}/api/imports/audio`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) {
      let errorMessage = res.statusText;
      try {
        const errorData = await res.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        errorMessage = await res.text() || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return await res.json() as { audioUrl: string };
  },

  listDecks: (token: string) => request<DeckDTO[]>("/api/decks", {}, token),

  createDeck: (token: string, input: CreateDeckInput) =>
    request<DeckDTO>("/api/decks", { method: "POST", body: JSON.stringify(input) }, token),

  updateDeck: (token: string, deckId: string, input: UpdateDeckInput) =>
    request<DeckDTO>(`/api/decks/${deckId}`, { method: "PATCH", body: JSON.stringify(input) }, token),

  deleteDeck: (token: string, deckId: string) =>
    request<{ ok: boolean }>(`/api/decks/${deckId}`, { method: "DELETE" }, token),

  listWordsPage: (token: string, deckId: string, options?: { cursor?: string | null; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.cursor) params.set("cursor", options.cursor);
    if (options?.limit) params.set("limit", String(options.limit));
    const query = params.toString();
    const suffix = query ? `?${query}` : "";
    return request<{ words: WordDTO[]; nextCursor: string | null; isDone: boolean; totalCount: number | null }>(
      `/api/decks/${deckId}/words/page${suffix}`,
      {},
      token,
    );
  },

  createWord: (token: string, deckId: string, input: CreateWordInput) =>
    request<WordDTO>(`/api/decks/${deckId}/words`, { method: "POST", body: JSON.stringify(input) }, token),

  createWordsBatch: (token: string, deckId: string, input: CreateWordsBatchInput) =>
    request<{ created: number; words: WordDTO[] }>(
      `/api/decks/${deckId}/words/batch`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),

  updateWord: (token: string, wordId: string, input: UpdateWordInput) =>
    request<WordDTO>(`/api/words/${wordId}`, { method: "PATCH", body: JSON.stringify(input) }, token),

  deleteWord: (token: string, wordId: string) =>
    request<{ ok: boolean }>(`/api/words/${wordId}`, { method: "DELETE" }, token),

  deleteWordsBatch: (token: string, deckId: string, input: DeleteWordsBatchInput) =>
    request<{ deleted: number; failedWordIds: string[] }>(
      `/api/decks/${deckId}/words/batch-delete`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),

  startPractice: (token: string, deckId: string) =>
    request<StartPracticeResponse>(
      "/api/practice/session/start",
      { method: "POST", body: JSON.stringify({ deckId }) },
      token,
    ),

  submitPractice: (
    token: string,
    sessionId: string,
    wordId: string,
    input: SubmitPracticeCardInput,
  ) =>
    request<SubmitPracticeResponse>(
      `/api/practice/session/${sessionId}/card/submit?wordId=${wordId}`,
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),

  finishPractice: (token: string, sessionId: string) =>
    request<SessionSummaryDTO>(`/api/practice/session/${sessionId}/finish`, { method: "POST" }, token),
  getPracticeSessionDetails: (token: string, sessionId: string) =>
    request<PracticeSessionDetails>(`/api/practice/session/${sessionId}`, {}, token),

  fetchWordTts: (token: string, wordId: string, deckId: string, voice: string, rate: "-20%" | "default" | "+20%") =>
    requestBlob(
      `/api/words/${wordId}/tts?deckId=${encodeURIComponent(deckId)}&voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(rate)}`,
      {},
      token,
    ),
};
