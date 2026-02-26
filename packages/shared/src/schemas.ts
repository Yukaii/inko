import { z } from "zod";

export const LanguageSchema = z.literal("ja");

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
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

export const UpdateWordSchema = CreateWordSchema.partial();

export const StartPracticeSessionSchema = z.object({
  deckId: z.string(),
});

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
export type UpdateWordInput = z.infer<typeof UpdateWordSchema>;
export type StartPracticeSessionInput = z.infer<typeof StartPracticeSessionSchema>;
export type SubmitPracticeCardInput = z.infer<typeof SubmitPracticeCardSchema>;
