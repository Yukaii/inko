"use node";

import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { EdgeTTS } from "node-edge-tts";

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

export const ensureWordAudio = action({
  args: {
    userId: v.id("users"),
    wordId: v.id("words"),
  },
  handler: async (ctx, args): Promise<{ audioUrl: string }> => {
    const word = await ctx.runQuery(api.words.getById, { wordId: args.wordId }) as {
      _id: string;
      userId: string;
      language: keyof typeof SPEECH_CONFIG_BY_LANGUAGE;
      target: string;
      audioUrl?: string;
    } | null;

    if (!word) {
      throw new Error("Word not found");
    }
    if (`${word.userId}` !== `${args.userId}`) {
      throw new Error("Forbidden");
    }
    if (word.audioUrl) {
      return { audioUrl: word.audioUrl };
    }

    const speechConfig = SPEECH_CONFIG_BY_LANGUAGE[word.language] ?? { voice: "en-US-EmmaNeural", lang: "en-US" };
    const tts = new EdgeTTS({
      voice: speechConfig.voice,
      lang: speechConfig.lang,
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      saveSubtitles: false,
    });

    const tempDir = await mkdtemp(join(tmpdir(), "inko-convex-tts-"));
    const audioPath = join(tempDir, `${randomUUID()}.mp3`);

    try {
      await tts.ttsPromise(word.target, audioPath);
      const audio = await readFile(audioPath);
      const blob = new Blob([audio], { type: "audio/mpeg" });
      const audioStorageId = await ctx.storage.store(blob);
      const audioUrl = await ctx.storage.getUrl(audioStorageId);
      if (!audioUrl) {
        throw new Error("Failed to resolve stored audio URL");
      }

      await ctx.runMutation((internal as any).tts.persistWordAudio, {
        wordId: args.wordId,
        audioStorageId,
        audioUrl,
      });

      return { audioUrl };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },
});
