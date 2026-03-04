import type { LanguageCode, ThemeConfig, TypingMode } from "@inko/shared";
import type { ColumnType } from "kysely";

export type TimestampMs = ColumnType<number, number | undefined, number | undefined>;
export type JsonColumn<T> = ColumnType<T, T | undefined, T | undefined>;
export type ThemeMode = "dark" | "light";
export type TtsRate = "-20%" | "default" | "+20%";
export type CommunityDifficulty = "Beginner" | "Intermediate" | "Advanced";
export type CommunitySourceKind = "apkg" | "colpkg" | "csv" | "tsv" | "community_clone" | "manual";
export type CommunitySubmissionStatus = "pending" | "approved" | "rejected";

export type NoteTypeRecord = { name: string; fields: string[] };
export type WordPayload = {
  target: string;
  reading?: string;
  romanization?: string;
  meaning: string;
  example?: string;
  audioUrl?: string;
  tags: string[];
};

export interface UsersTable {
  id: string;
  email: string;
  display_name: string | null;
  theme_mode: ThemeMode | null;
  typing_mode: TypingMode | null;
  tts_enabled: boolean;
  themes: JsonColumn<ThemeConfig>;
  created_at: TimestampMs;
}

export interface DecksTable {
  id: string;
  user_id: string;
  name: string;
  language: LanguageCode;
  archived: boolean;
  tts_enabled: boolean;
  tts_voice: string;
  tts_rate: TtsRate;
  word_count: number;
  created_at: TimestampMs;
}

export interface WordsTable {
  id: string;
  user_id: string;
  language: LanguageCode;
  target: string;
  reading: string | null;
  romanization: string | null;
  meaning: string;
  example: string | null;
  audio_url: string | null;
  tags: JsonColumn<string[]>;
  created_at: TimestampMs;
}

export interface DeckWordsTable {
  id: string;
  deck_id: string;
  word_id: string;
  position: number;
  created_at: TimestampMs;
}

export interface WordChannelStatsTable {
  id: string;
  user_id: string;
  word_id: string;
  shape_strength: number;
  typing_strength: number;
  listening_strength: number;
  shape_due_at: TimestampMs;
  typing_due_at: TimestampMs;
  listening_due_at: TimestampMs;
  last_practiced_at: TimestampMs | null;
}

export interface PracticeSessionsTable {
  id: string;
  user_id: string;
  deck_id: string;
  started_at: TimestampMs;
  finished_at: TimestampMs | null;
  cards_completed: number;
  attempted_word_ids: JsonColumn<string[]>;
}

export interface PracticeAttemptsTable {
  id: string;
  session_id: string;
  word_id: string;
  shape_score: number;
  typing_score: number;
  listening_score: number;
  typing_ms: number;
  submitted_at: TimestampMs;
}

export interface DailyStatsTable {
  id: string;
  user_id: string;
  date: string;
  words_completed: number;
  seconds_spent: number;
  streak_count: number;
}

export interface CommunityDecksTable {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  language: LanguageCode;
  difficulty: CommunityDifficulty;
  author_name: string;
  source_submission_id: string | null;
  published_by_user_id: string | null;
  downloads: number;
  rating: number;
  rating_count: number;
  card_count: number;
  tags: JsonColumn<string[]>;
  note_types: JsonColumn<NoteTypeRecord[]>;
  words: JsonColumn<WordPayload[]>;
  published_at: TimestampMs;
  updated_at: TimestampMs;
}

export interface CommunityDeckCommentsTable {
  id: string;
  deck_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: TimestampMs;
  updated_at: TimestampMs;
}

export interface CommunityDeckRatingsTable {
  id: string;
  deck_id: string;
  user_id: string;
  rating: number;
  created_at: TimestampMs;
  updated_at: TimestampMs;
}

export interface CommunityDeckSubmissionsTable {
  id: string;
  submitter_user_id: string;
  submitter_email: string;
  title: string;
  summary: string;
  description: string;
  language: LanguageCode;
  difficulty: CommunityDifficulty;
  source_kind: CommunitySourceKind;
  source_name: string;
  card_count: number;
  tags: JsonColumn<string[]>;
  note_types: JsonColumn<NoteTypeRecord[]>;
  words: JsonColumn<WordPayload[]>;
  status: CommunitySubmissionStatus;
  moderation_notes: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: TimestampMs | null;
  created_at: TimestampMs;
  updated_at: TimestampMs;
}

export interface MagicLinkTokensTable {
  token: string;
  email: string;
  expires_at: TimestampMs;
  created_at: TimestampMs;
}

export interface Database {
  users: UsersTable;
  decks: DecksTable;
  words: WordsTable;
  deck_words: DeckWordsTable;
  word_channel_stats: WordChannelStatsTable;
  practice_sessions: PracticeSessionsTable;
  practice_attempts: PracticeAttemptsTable;
  daily_stats: DailyStatsTable;
  community_decks: CommunityDecksTable;
  community_deck_comments: CommunityDeckCommentsTable;
  community_deck_ratings: CommunityDeckRatingsTable;
  community_deck_submissions: CommunityDeckSubmissionsTable;
  magic_link_tokens: MagicLinkTokensTable;
}
