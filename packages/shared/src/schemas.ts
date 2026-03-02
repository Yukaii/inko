import { z } from "zod";

export const SUPPORTED_LANGUAGES = [
  "ja",
  "ko",
  "zh",
  "es",
  "fr",
  "de",
  "it",
  "pt",
  "ru",
  "ar",
  "hi",
  "th",
] as const;
export const LanguageSchema = z.enum(SUPPORTED_LANGUAGES);
export const LANGUAGE_LABELS: Record<z.infer<typeof LanguageSchema>, string> = {
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  th: "Thai",
};
export const ThemeModeSchema = z.union([z.literal("dark"), z.literal("light")]);
export const TypingModeSchema = z.union([z.literal("language_specific"), z.literal("universal")]);
export const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const EDGE_TTS_RATE_PRESETS = ["-20%", "default", "+20%"] as const;
export const EdgeTtsRateSchema = z.enum(EDGE_TTS_RATE_PRESETS);

export const EDGE_TTS_VOICE_OPTIONS_BY_LANGUAGE = {
  ja: [
    { value: "ja-JP-NanamiNeural", label: "Nanami" },
    { value: "ja-JP-KeitaNeural", label: "Keita" },
  ],
  ko: [
    { value: "ko-KR-SunHiNeural", label: "SunHi" },
    { value: "ko-KR-InJoonNeural", label: "InJoon" },
  ],
  zh: [
    { value: "zh-CN-XiaoxiaoNeural", label: "Xiaoxiao" },
    { value: "zh-CN-YunxiNeural", label: "Yunxi" },
  ],
  es: [
    { value: "es-ES-ElviraNeural", label: "Elvira" },
    { value: "es-ES-AlvaroNeural", label: "Alvaro" },
  ],
  fr: [
    { value: "fr-FR-DeniseNeural", label: "Denise" },
    { value: "fr-FR-HenriNeural", label: "Henri" },
  ],
  de: [
    { value: "de-DE-KatjaNeural", label: "Katja" },
    { value: "de-DE-ConradNeural", label: "Conrad" },
  ],
  it: [
    { value: "it-IT-ElsaNeural", label: "Elsa" },
    { value: "it-IT-DiegoNeural", label: "Diego" },
  ],
  pt: [
    { value: "pt-BR-FranciscaNeural", label: "Francisca" },
    { value: "pt-BR-AntonioNeural", label: "Antonio" },
  ],
  ru: [
    { value: "ru-RU-SvetlanaNeural", label: "Svetlana" },
    { value: "ru-RU-DmitryNeural", label: "Dmitry" },
  ],
  ar: [
    { value: "ar-SA-ZariyahNeural", label: "Zariyah" },
    { value: "ar-SA-HamedNeural", label: "Hamed" },
  ],
  hi: [
    { value: "hi-IN-SwaraNeural", label: "Swara" },
    { value: "hi-IN-MadhurNeural", label: "Madhur" },
  ],
  th: [
    { value: "th-TH-PremwadeeNeural", label: "Premwadee" },
    { value: "th-TH-NiwatNeural", label: "Niwat" },
  ],
} as const satisfies Record<z.infer<typeof LanguageSchema>, readonly { value: string; label: string }[]>;

export const EDGE_TTS_VOICE_IDS = Object.values(EDGE_TTS_VOICE_OPTIONS_BY_LANGUAGE)
  .flatMap((options) => options.map((option) => option.value)) as [string, ...string[]];
export const EdgeTtsVoiceSchema = z.enum(EDGE_TTS_VOICE_IDS);

export function getDefaultEdgeTtsVoice(language: z.infer<typeof LanguageSchema>) {
  return EDGE_TTS_VOICE_OPTIONS_BY_LANGUAGE[language][0].value;
}

export const ThemePaletteSchema = z.object({
  accentOrange: HexColorSchema,
  accentTeal: HexColorSchema,
  bgPage: HexColorSchema,
  bgCard: HexColorSchema,
  bgElevated: HexColorSchema,
  textPrimary: HexColorSchema,
  textSecondary: HexColorSchema,
  textOnAccent: HexColorSchema,
});

export const ThemeConfigSchema = z.object({
  dark: ThemePaletteSchema,
  light: ThemePaletteSchema,
});

export const DefaultThemes = {
  dark: {
    accentOrange: "#ff6b35",
    accentTeal: "#00d4aa",
    bgPage: "#1a1a1a",
    bgCard: "#212121",
    bgElevated: "#2d2d2d",
    textPrimary: "#ffffff",
    textSecondary: "#777777",
    textOnAccent: "#0d0d0d",
  },
  light: {
    accentOrange: "#ff6b35",
    accentTeal: "#0f766e",
    bgPage: "#f6f4ef",
    bgCard: "#ffffff",
    bgElevated: "#ece7df",
    textPrimary: "#111827",
    textSecondary: "#4b5563",
    textOnAccent: "#111827",
  },
} satisfies z.infer<typeof ThemeConfigSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().min(1).max(60),
  themeMode: ThemeModeSchema,
  typingMode: TypingModeSchema,
  ttsEnabled: z.boolean(),
  canModerateCommunity: z.boolean().default(false),
  themes: ThemeConfigSchema,
  createdAt: z.number(),
});

export const DeckSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1),
  language: LanguageSchema,
  archived: z.boolean(),
  ttsEnabled: z.boolean(),
  ttsVoice: EdgeTtsVoiceSchema,
  ttsRate: EdgeTtsRateSchema,
  createdAt: z.number(),
});

export const WordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  language: LanguageSchema,
  target: z.string().min(1),
  reading: z.string().optional(),
  romanization: z.string().optional(),
  meaning: z.string().min(1),
  example: z.string().optional(),
  audioUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
});

export const PracticeCardSchema = z.object({
  wordId: z.string(),
  deckId: z.string(),
  language: LanguageSchema,
  target: z.string(),
  reading: z.string().optional(),
  romanization: z.string().optional(),
  meaning: z.string(),
  example: z.string().optional(),
  audioUrl: z.string().optional(),
});

export const SessionSummarySchema = z.object({
  sessionId: z.string(),
  cardsCompleted: z.number().int().nonnegative(),
  avgShapeScore: z.number(),
  avgTypingScore: z.number(),
  avgListeningScore: z.number(),
  durationSeconds: z.number().nonnegative(),
});

export const MagicLinkRequestSchema = z.object({ email: z.string().email() });
export const MagicLinkVerifySchema = z.object({ token: z.string().min(16) });
export const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  themeMode: ThemeModeSchema,
  typingMode: TypingModeSchema.default("language_specific"),
  ttsEnabled: z.boolean().default(true),
  themes: ThemeConfigSchema,
});

export const UpdatePreferencesSchema = z.object({
  ttsEnabled: z.boolean(),
});

export const CreateDeckSchema = z.object({
  name: z.string().min(1),
  language: LanguageSchema.default("ja"),
});

export const UpdateDeckSchema = z.object({
  name: z.string().min(1).optional(),
  language: LanguageSchema.optional(),
  archived: z.boolean().optional(),
  ttsEnabled: z.boolean().optional(),
  ttsVoice: EdgeTtsVoiceSchema.optional(),
  ttsRate: EdgeTtsRateSchema.optional(),
});

export const CreateWordSchema = z.object({
  target: z.string().min(1),
  reading: z.string().optional(),
  romanization: z.string().optional(),
  meaning: z.string().min(1),
  example: z.string().optional(),
  audioUrl: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
});

export const CommunityDeckDifficultySchema = z.union([
  z.literal("Beginner"),
  z.literal("Intermediate"),
  z.literal("Advanced"),
]);

export const CommunityDeckNoteTypeSchema = z.object({
  name: z.string().min(1),
  fields: z.array(z.string().min(1)).min(1),
});

export const CommunityDeckSummarySchema = z.object({
  id: z.string(),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  language: LanguageSchema,
  difficulty: CommunityDeckDifficultySchema,
  authorName: z.string().min(1),
  downloads: z.number().int().nonnegative(),
  rating: z.number().min(0).max(5),
  ratingCount: z.number().int().nonnegative(),
  cardCount: z.number().int().nonnegative(),
  updatedAt: z.number(),
  tags: z.array(z.string()).default([]),
});

export const CommunityDeckCommentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  authorName: z.string().min(1),
  body: z.string().min(1).max(2000),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const CommunityDeckDetailSchema = CommunityDeckSummarySchema.extend({
  description: z.string().min(1),
  noteTypes: z.array(CommunityDeckNoteTypeSchema).default([]),
  words: z.array(CreateWordSchema),
  viewerRating: z.number().int().min(1).max(5).optional(),
  comments: z.array(CommunityDeckCommentSchema).default([]),
});

export const CommunitySubmissionStatusSchema = z.union([
  z.literal("pending"),
  z.literal("approved"),
  z.literal("rejected"),
]);

export const CommunitySourceKindSchema = z.union([
  z.literal("apkg"),
  z.literal("colpkg"),
  z.literal("csv"),
  z.literal("tsv"),
  z.literal("community_clone"),
  z.literal("manual"),
]);

export const CommunityDeckSubmissionSchema = z.object({
  id: z.string(),
  submitterUserId: z.string(),
  submitterEmail: z.string().email(),
  title: z.string().min(1),
  summary: z.string().min(1),
  description: z.string().min(1),
  language: LanguageSchema,
  difficulty: CommunityDeckDifficultySchema,
  sourceKind: CommunitySourceKindSchema,
  sourceName: z.string().min(1),
  cardCount: z.number().int().nonnegative(),
  tags: z.array(z.string()).default([]),
  noteTypes: z.array(CommunityDeckNoteTypeSchema).default([]),
  sampleWords: z.array(CreateWordSchema).default([]),
  status: CommunitySubmissionStatusSchema,
  moderationNotes: z.string().optional(),
  reviewedByUserId: z.string().optional(),
  reviewedAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const CreateWordsBatchSchema = z.object({
  words: z.array(CreateWordSchema).min(1).max(10000),
});

export const CreateCommunityDeckSubmissionSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(220),
  description: z.string().min(1).max(2000),
  language: LanguageSchema,
  difficulty: CommunityDeckDifficultySchema.default("Beginner"),
  sourceKind: CommunitySourceKindSchema,
  sourceName: z.string().min(1).max(200),
  tags: z.array(z.string().min(1)).max(24).default([]),
  noteTypes: z.array(CommunityDeckNoteTypeSchema).max(32).default([]),
  words: z.array(CreateWordSchema).min(1).max(5000),
});

export const ReviewCommunityDeckSubmissionSchema = z.object({
  status: z.union([z.literal("approved"), z.literal("rejected")]),
  moderationNotes: z.string().trim().max(1000).optional(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80)
    .optional(),
});

export const RateCommunityDeckSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

export const CreateCommunityDeckCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const DeleteWordsBatchSchema = z.object({
  wordIds: z.array(z.string()).min(1).max(10000),
});

export const UpdateWordSchema = CreateWordSchema.partial();

export const StartPracticeSessionSchema = z.object({
  deckId: z.string(),
});

export const PRACTICE_SESSION_CARD_CAP_DEFAULT = 50;

export const SubmitPracticeCardSchema = z.object({
  handwritingCompleted: z.boolean(),
  typingInput: z.string(),
  typingMs: z.number().int().nonnegative(),
  audioPlayed: z.boolean(),
  listeningConfidence: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
});

export const ErrorCode = {
  INTERNAL_ERROR: "INTERNAL_ERROR",
  INVALID_TOKEN: "INVALID_TOKEN",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  DECK_NOT_FOUND: "DECK_NOT_FOUND",
  WORD_NOT_FOUND: "WORD_NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type UserDTO = z.infer<typeof UserSchema>;
export type DeckDTO = z.infer<typeof DeckSchema>;
export type CommunityDeckSummaryDTO = z.infer<typeof CommunityDeckSummarySchema>;
export type CommunityDeckDetailDTO = z.infer<typeof CommunityDeckDetailSchema>;
export type CommunityDeckCommentDTO = z.infer<typeof CommunityDeckCommentSchema>;
export type CommunityDeckSubmissionDTO = z.infer<typeof CommunityDeckSubmissionSchema>;
export type WordDTO = z.infer<typeof WordSchema>;
export type PracticeCardDTO = z.infer<typeof PracticeCardSchema>;
export type SessionSummaryDTO = z.infer<typeof SessionSummarySchema>;
export type EdgeTtsVoice = z.infer<typeof EdgeTtsVoiceSchema>;
export type EdgeTtsRate = z.infer<typeof EdgeTtsRateSchema>;

export type CreateDeckInput = z.infer<typeof CreateDeckSchema>;
export type UpdateDeckInput = z.infer<typeof UpdateDeckSchema>;
export type CreateWordInput = z.infer<typeof CreateWordSchema>;
export type CreateWordsBatchInput = z.infer<typeof CreateWordsBatchSchema>;
export type CreateCommunityDeckSubmissionInput = z.infer<typeof CreateCommunityDeckSubmissionSchema>;
export type CreateCommunityDeckCommentInput = z.infer<typeof CreateCommunityDeckCommentSchema>;
export type DeleteWordsBatchInput = z.infer<typeof DeleteWordsBatchSchema>;
export type RateCommunityDeckInput = z.infer<typeof RateCommunityDeckSchema>;
export type ReviewCommunityDeckSubmissionInput = z.infer<typeof ReviewCommunityDeckSubmissionSchema>;
export type UpdateWordInput = z.infer<typeof UpdateWordSchema>;
export type StartPracticeSessionInput = z.infer<typeof StartPracticeSessionSchema>;
export type SubmitPracticeCardInput = z.infer<typeof SubmitPracticeCardSchema>;
export type ThemeMode = z.infer<typeof ThemeModeSchema>;
export type ThemePalette = z.infer<typeof ThemePaletteSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;
export type LanguageCode = z.infer<typeof LanguageSchema>;
export type TypingMode = z.infer<typeof TypingModeSchema>;
export type CommunitySubmissionStatus = z.infer<typeof CommunitySubmissionStatusSchema>;
