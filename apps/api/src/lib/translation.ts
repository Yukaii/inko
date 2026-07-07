import { LANGUAGE_LABELS, ReadingTranslationSchema, type TranslateReadingParagraphInput } from "@inko/shared";
import { env } from "./env";

export type TranslationService = {
  translateParagraph(input: TranslateReadingParagraphInput): Promise<ReturnType<typeof ReadingTranslationSchema.parse>>;
};

const SENTENCE_SPLIT_PATTERN = /(?<=[。！？.!?])\s+|(?<=[。！？!?])|(?<=[.!?])\s+/u;
const TOKEN_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{L}][\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{L}\p{M}'’-]*/gu;

function splitSentences(paragraph: string) {
  const parts = paragraph
    .split(SENTENCE_SPLIT_PATTERN)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [paragraph.trim()];
}

function buildFallbackTranslation(input: TranslateReadingParagraphInput) {
  const sentences = splitSentences(input.paragraph);
  const sourceLabel = LANGUAGE_LABELS[input.sourceLanguage];
  return ReadingTranslationSchema.parse({
    engine: "fallback",
    translation: sentences.map((sentence) => `[${sourceLabel} -> ${input.translationLanguage}] ${sentence}`).join(" "),
    sentenceTranslations: sentences.map((sentence) => ({
      source: sentence,
      translation: `[${sourceLabel} -> ${input.translationLanguage}] ${sentence}`,
    })),
    meaningHints: extractFallbackMeaningHints(input.paragraph),
  });
}

function extractFallbackMeaningHints(paragraph: string) {
  const seen = new Set<string>();
  const hints: Array<{ term: string; meaning: string }> = [];
  for (const match of paragraph.matchAll(TOKEN_PATTERN)) {
    const term = match[0].trim();
    if (term.length < 2 || seen.has(term)) continue;
    seen.add(term);
    hints.push({ term, meaning: "Add or confirm this meaning while translating." });
    if (hints.length >= 12) break;
  }
  return hints;
}

async function translateWithOpenAiCompatible(input: TranslateReadingParagraphInput) {
  const response = await fetch(env.TRANSLATION_API_URL!, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.TRANSLATION_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.TRANSLATION_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Translate language-learning reading passages. Return strict JSON with translation, sentenceTranslations, and meaningHints. sentenceTranslations is an array of {source, translation}. meaningHints is an array of {term, meaning}.",
        },
        {
          role: "user",
          content: JSON.stringify({
            sourceLanguage: LANGUAGE_LABELS[input.sourceLanguage],
            translationLanguage: input.translationLanguage,
            paragraph: input.paragraph,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Translation provider failed: ${response.status}`);
  }

  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Translation provider returned an empty response.");
  }

  const parsed = JSON.parse(content) as unknown;
  return ReadingTranslationSchema.parse({
    engine: "openai_compatible",
    ...(parsed && typeof parsed === "object" ? parsed : {}),
  });
}

export const translationService: TranslationService = {
  async translateParagraph(input) {
    if (env.TRANSLATION_PROVIDER === "openai_compatible") {
      return await translateWithOpenAiCompatible(input);
    }
    return buildFallbackTranslation(input);
  },
};
