import type {
  CreateDeckInput,
  CreateWordsBatchInput,
  CreateWordInput,
  DeckDTO,
  DeleteWordsBatchInput,
  PracticeCardDTO,
  SessionSummaryDTO,
  SubmitPracticeCardInput,
  TypingMode,
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

type AuthVerifyResponse = { accessToken: string; user: UserDTO };
type StartPracticeResponse = {
  sessionId: string;
  card: PracticeCardDTO;
  upcomingCards?: PracticeCardDTO[];
  typingMode?: TypingMode;
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
  dashboard: (token: string) => request<DashboardSummary>("/api/dashboard/summary", {}, token),
  dashboardStats: (token: string) => request<DashboardStats>("/api/dashboard/stats", {}, token),
  dashboardRecentSessions: (token: string) =>
    request<DashboardRecentSessions>("/api/dashboard/recent-sessions", {}, token),

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

  fetchWordTts: (token: string, wordId: string) =>
    requestBlob(`/api/words/${wordId}/tts`, {}, token),
};
