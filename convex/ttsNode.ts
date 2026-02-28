"use node";

import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { EdgeTTS } from "node-edge-tts";
import { getDefaultEdgeTtsVoice, type LanguageCode, type EdgeTtsRate } from "@inko/shared";

const SPEECH_CONFIG_BY_LANGUAGE = {
  ja: { voice: "ja-JP-NanamiNeural", lang: "ja-JP" },
  ko: { voice: "ko-KR-SunHiNeural", lang: "ko-KR" },
  zh: { voice: "zh-CN-XiaoxiaoNeural", lang: "zh-CN" },
  es: { voice: "es-ES-ElviraNeural", lang: "es-ES" },
  fr: { voice: "fr-FR-DeniseNeural", lang: "fr-FR" },
  de: { voice: "de-DE-KatjaNeural", lang: "de-DE" },
  it: { voice: "it-IT-ElsaNeural", lang: "it-IT" },
  pt: { voice: "pt-BR-FranciscaNeural", lang: "pt-BR" },
  ru: { voice: "ru-RU-SvetlanaNeural", lang: "ru-RU" },
  ar: { voice: "ar-SA-ZariyahNeural", lang: "ar-SA" },
  hi: { voice: "hi-IN-SwaraNeural", lang: "hi-IN" },
  th: { voice: "th-TH-PremwadeeNeural", lang: "th-TH" },
} as const;

const TTS_NODE_DEPLOY_MARKER = "ttsNode-debug-2026-02-28-v3";

function getProxyDiagnostics() {
  const proxyKeys = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"] as const;
  return proxyKeys
    .map((key) => {
      const value = process.env[key];
      if (!value) return null;
      try {
        const parsed = new URL(value);
        return `${key}=${parsed.protocol}//${parsed.host}`;
      } catch {
        return `${key}=INVALID`;
      }
    })
    .filter((value): value is string => value !== null);
}

export const ensureWordAudio = action({
  args: {
    userId: v.id("users"),
    deckId: v.id("decks"),
    wordId: v.id("words"),
    voice: v.optional(v.string()),
    rate: v.optional(v.union(v.literal("-20%"), v.literal("default"), v.literal("+20%"))),
  },
  handler: async (ctx, args): Promise<{ audioUrl: string }> => {
    if (process.env.INKO_TTS_DEBUG_MARKER === "1") {
      throw new Error(`TTS debug marker reached: ${TTS_NODE_DEPLOY_MARKER}`);
    }

    const withStep = async <T,>(step: string, fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`[ttsNode step=${step}] ${errorMessage}`);
      }
    };

    const word = await withStep("load-word", async () =>
      await ctx.runQuery(api.words.getById, { wordId: args.wordId }) as {
        _id: string;
        userId: string;
        language: LanguageCode;
        target: string;
        audioUrl?: string;
      } | null,
    );
    const deck = await withStep("load-deck", async () =>
      await ctx.runQuery(api.decks.getDeckById, { deckId: args.deckId }) as {
        _id: string;
        userId: string;
        language: LanguageCode;
        ttsEnabled?: boolean;
        ttsVoice?: string;
        ttsRate?: EdgeTtsRate;
      } | null,
    );

    if (!word) throw new Error("Word not found");
    if (!deck) throw new Error("Deck not found");
    if (`${word.userId}` !== `${args.userId}` || `${deck.userId}` !== `${args.userId}`) {
      throw new Error("Forbidden");
    }
    const inDeck = await withStep("check-word-in-deck", async () =>
      await ctx.runQuery(api.decks.isWordInDeck, {
        deckId: args.deckId,
        wordId: args.wordId,
      }) as boolean,
    );
    if (!inDeck) {
      throw new Error("Word not found in deck");
    }

    const voice = args.voice ?? deck.ttsVoice ?? getDefaultEdgeTtsVoice(deck.language);
    const rate = args.rate ?? deck.ttsRate ?? "default";
    const cachedAudio = await withStep("lookup-cached-audio", async () =>
      await ctx.runQuery(api.tts.getDeckWordAudio, {
        deckId: args.deckId,
        wordId: args.wordId,
        voice,
        rate,
      }) as { audioUrl: string } | null,
    );

    if (cachedAudio?.audioUrl) {
      return { audioUrl: cachedAudio.audioUrl };
    }

    const speechConfig = SPEECH_CONFIG_BY_LANGUAGE[word.language] ?? { voice: "en-US-EmmaNeural", lang: "en-US" };
    const tts = await withStep("create-edge-tts", async () =>
      new EdgeTTS({
        voice,
        lang: speechConfig.lang,
        outputFormat: "audio-24khz-48kbitrate-mono-mp3",
        rate,
        saveSubtitles: false,
      }),
    );

    const tempDir = await mkdtemp(join(tmpdir(), "inko-convex-tts-"));
    const audioPath = join(tempDir, `${randomUUID()}.mp3`);

    try {
      try {
        await tts.ttsPromise(word.target, audioPath);
      } catch (error) {
        console.error("ttsNode.ensureWordAudio synthesis failed", {
          wordId: args.wordId,
          deckId: args.deckId,
          language: word.language,
          voice,
          rate,
          proxies: getProxyDiagnostics(),
          error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
        });
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(
          `TTS synthesis failed: ${errorMessage}; language=${word.language}; voice=${voice}; rate=${rate}; proxies=${getProxyDiagnostics().join(",") || "none"}`,
        );
      }

      const audio = await withStep("read-audio-file", async () => await readFile(audioPath));
      const blob = new Blob([audio], { type: "audio/mpeg" });
      const audioStorageId = await withStep("store-audio-blob", async () => await ctx.storage.store(blob));
      const audioUrl = await withStep("resolve-storage-url", async () => await ctx.storage.getUrl(audioStorageId));
      if (!audioUrl) {
        throw new Error("Failed to resolve stored audio URL");
      }
      try {
        new URL(audioUrl);
      } catch (error) {
        console.error("ttsNode.ensureWordAudio invalid storage URL", {
          wordId: args.wordId,
          deckId: args.deckId,
          audioStorageId,
          audioUrl,
          error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
        });
        throw new Error(`Invalid storage URL returned by Convex: ${audioUrl}; storageId=${audioStorageId}`);
      }

      await withStep("persist-audio-cache", async () =>
        await ctx.runMutation((internal as any).tts.persistDeckWordAudio, {
          deckId: args.deckId,
          wordId: args.wordId,
          voice,
          rate,
          audioStorageId,
          audioUrl,
        }),
      );

      return { audioUrl };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },
});
