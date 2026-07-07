import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGateway, generateText, jsonSchema, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { LANGUAGE_LABELS, ReadingTranslationSchema, type TranslateReadingParagraphInput } from "@inko/shared";
import { env } from "./env";

export type TranslationService = {
  translateParagraph(input: TranslateReadingParagraphInput): Promise<ReturnType<typeof ReadingTranslationSchema.parse>>;
};

const SENTENCE_SPLIT_PATTERN = /(?<=[。！？.!?])\s+|(?<=[。！？!?])|(?<=[.!?])\s+/u;
const TOKEN_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{L}][\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{L}\p{M}'’-]*/gu;

const TranslationOutputSchema = z.object({
  translation: z.string().describe("Natural full-paragraph translation."),
  sentenceTranslations: z
    .array(
      z.object({
        source: z.string().describe("Original source-language sentence."),
        translation: z.string().describe("Translation of this sentence."),
      }),
    )
    .describe("Sentence-aligned translations in original sentence order."),
  meaningHints: z
    .array(
      z.object({
        term: z.string().describe("Important source-language word or phrase."),
        meaning: z.string().describe("Short learner-friendly meaning in the translation language."),
      }),
    )
    .max(16)
    .describe("Useful vocabulary or phrase hints for reading comprehension."),
});
const TranslationOutputJsonSchema = jsonSchema<unknown>({
  type: "object",
  additionalProperties: false,
  required: ["translation", "sentenceTranslations", "meaningHints"],
  properties: {
    translation: {
      type: "string",
      description: "Natural full-paragraph translation.",
    },
    sentenceTranslations: {
      type: "array",
      description: "Sentence-aligned translations in original sentence order.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source", "translation"],
        properties: {
          source: { type: "string", description: "Original source-language sentence." },
          translation: { type: "string", description: "Translation of this sentence." },
        },
      },
    },
    meaningHints: {
      type: "array",
      description: "Useful vocabulary or phrase hints for reading comprehension.",
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["term", "meaning"],
        properties: {
          term: { type: "string", description: "Important source-language word or phrase." },
          meaning: { type: "string", description: "Short learner-friendly meaning in the translation language." },
        },
      },
    },
  },
});
const translationOutput = Output.object({
  schema: TranslationOutputJsonSchema,
  name: "ReadingTranslation",
  description: "Sentence-aligned translation result for language-learning reading practice.",
});

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

function getBaseUrl() {
  return env.TRANSLATION_BASE_URL ?? env.TRANSLATION_API_URL;
}

function getOpenCodeZenBaseUrl() {
  return env.OPENCODE_ZEN_BASE_URL ?? getBaseUrl();
}

function resolveTranslationModel(): { engine: string; model: LanguageModel } | null {
  if (env.TRANSLATION_PROVIDER === "fallback") {
    return null;
  }

  if (env.TRANSLATION_PROVIDER === "openai") {
    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY ?? env.TRANSLATION_API_KEY,
      baseURL: getBaseUrl(),
    });
    return { engine: "openai", model: openai.chat(env.TRANSLATION_MODEL) };
  }

  if (env.TRANSLATION_PROVIDER === "vercel_gateway") {
    const gateway = createGateway({
      apiKey: env.AI_GATEWAY_API_KEY ?? env.TRANSLATION_API_KEY,
      baseURL: env.AI_GATEWAY_BASE_URL ?? getBaseUrl(),
    });
    return { engine: "vercel_gateway", model: gateway(env.TRANSLATION_MODEL) };
  }

  if (env.TRANSLATION_PROVIDER === "opencode_zen") {
    const provider = createOpenAICompatible({
      name: "opencode-zen",
      apiKey: env.OPENCODE_ZEN_API_KEY ?? env.TRANSLATION_API_KEY,
      baseURL: getOpenCodeZenBaseUrl()!,
      supportsStructuredOutputs: env.TRANSLATION_SUPPORTS_STRUCTURED_OUTPUTS,
    });
    return { engine: "opencode_zen", model: provider(env.TRANSLATION_MODEL) };
  }

  const provider = createOpenAICompatible({
    name: env.TRANSLATION_OPENAI_COMPATIBLE_NAME,
    apiKey: env.TRANSLATION_API_KEY,
    baseURL: getBaseUrl()!,
    supportsStructuredOutputs: env.TRANSLATION_SUPPORTS_STRUCTURED_OUTPUTS,
  });
  return { engine: "openai_compatible", model: provider(env.TRANSLATION_MODEL) };
}

async function translateWithAiSdk(input: TranslateReadingParagraphInput) {
  const resolved = resolveTranslationModel();
  if (!resolved) return buildFallbackTranslation(input);

  const sourceLanguage = LANGUAGE_LABELS[input.sourceLanguage];
  const { output } = await generateText({
    model: resolved.model,
    temperature: 0.2,
    system:
      "You are a language-learning translation engine. Keep output faithful to the source. " +
      "Return sentence-aligned translations and concise meaning hints for important vocabulary or phrases.",
    output: translationOutput,
    prompt: [
      `PARAGRAPH (${sourceLanguage})`,
      input.paragraph,
      "",
      `TARGET LANGUAGE: ${input.translationLanguage}`,
      "",
      "INSTRUCTIONS:",
      "- Translate the paragraph naturally into the target language.",
      "- Provide sentence-aligned translations (sentenceTranslations) in original sentence order.",
      "- For meaningHints, extract only important words/phrases that actually appear in the PARAGRAPH above. Do not invent or guess terms that are not present in the source text. Give each a short learner-friendly meaning in the target language.",
      "- Limit meaningHints to at most 12 entries.",
    ].join("\n"),
  });

  const parsedOutput = TranslationOutputSchema.parse(output);
  return ReadingTranslationSchema.parse({
    engine: resolved.engine,
    ...parsedOutput,
  });
}

export const translationService: TranslationService = {
  async translateParagraph(input) {
    return await translateWithAiSdk(input);
  },
};
