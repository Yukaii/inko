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
  themes: ThemeConfigSchema,
  createdAt: z.number(),
});

export const DeckSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1),
  language: LanguageSchema,
  archived: z.boolean(),
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
  themes: ThemeConfigSchema,
});

export const CreateDeckSchema = z.object({
  name: z.string().min(1),
  language: LanguageSchema.default("ja"),
});

export const UpdateDeckSchema = z.object({
  name: z.string().min(1).optional(),
  archived: z.boolean().optional(),
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

export const CreateWordsBatchSchema = z.object({
  words: z.array(CreateWordSchema).min(1).max(10000),
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

export type UserDTO = z.infer<typeof UserSchema>;
export type DeckDTO = z.infer<typeof DeckSchema>;
export type WordDTO = z.infer<typeof WordSchema>;
export type PracticeCardDTO = z.infer<typeof PracticeCardSchema>;
export type SessionSummaryDTO = z.infer<typeof SessionSummarySchema>;

export type CreateDeckInput = z.infer<typeof CreateDeckSchema>;
export type UpdateDeckInput = z.infer<typeof UpdateDeckSchema>;
export type CreateWordInput = z.infer<typeof CreateWordSchema>;
export type CreateWordsBatchInput = z.infer<typeof CreateWordsBatchSchema>;
export type DeleteWordsBatchInput = z.infer<typeof DeleteWordsBatchSchema>;
export type UpdateWordInput = z.infer<typeof UpdateWordSchema>;
export type StartPracticeSessionInput = z.infer<typeof StartPracticeSessionSchema>;
export type SubmitPracticeCardInput = z.infer<typeof SubmitPracticeCardSchema>;
export type ThemeMode = z.infer<typeof ThemeModeSchema>;
export type ThemePalette = z.infer<typeof ThemePaletteSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type LanguageCode = z.infer<typeof LanguageSchema>;
export type TypingMode = z.infer<typeof TypingModeSchema>;
