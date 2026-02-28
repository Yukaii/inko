import type { LanguageCode } from "@inko/shared";
import { convex } from "./convex";

export type TtsAudioResult = {
  audio: Buffer;
  contentType: string;
  fileName: string;
  audioUrl: string;
};

export type TtsService = {
  synthesizeWordAudio(input: {
    userId: string;
    deckId: string;
    wordId: string;
    targetHint?: string;
    voice?: string;
    rate?: "-20%" | "default" | "+20%";
  }): Promise<TtsAudioResult>;
};

function sanitizeFileName(text: string) {
  const trimmed = text.trim().slice(0, 48);
  const normalized = trimmed.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  return normalized || "word";
}

export function getVoiceForLanguage(language: LanguageCode) {
  const defaults: Record<LanguageCode, string> = {
    ja: "ja-JP-NanamiNeural",
    ko: "ko-KR-SunHiNeural",
    zh: "zh-CN-XiaoxiaoNeural",
    es: "es-ES-ElviraNeural",
    fr: "fr-FR-DeniseNeural",
    de: "de-DE-KatjaNeural",
    it: "it-IT-ElsaNeural",
    pt: "pt-BR-FranciscaNeural",
    ru: "ru-RU-SvetlanaNeural",
    ar: "ar-SA-ZariyahNeural",
    hi: "hi-IN-SwaraNeural",
    th: "th-TH-PremwadeeNeural",
  };
  return defaults[language] ?? "en-US-EmmaNeural";
}

export const ttsService: TtsService = {
  async synthesizeWordAudio(input) {
    const result = await (convex as any).action("ttsNode:ensureWordAudio", {
      userId: input.userId,
      deckId: input.deckId,
      wordId: input.wordId,
      voice: input.voice,
      rate: input.rate,
    }) as { audioUrl: string };

    try {
      new URL(result.audioUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid audioUrl returned from Convex action: ${result.audioUrl}; cause=${errorMessage}`);
    }

    let response: Response;
    try {
      response = await fetch(result.audioUrl);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch Convex audio URL: ${result.audioUrl}; cause=${errorMessage}`);
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch stored audio (${response.status}) from ${result.audioUrl}`);
    }

    return {
      audio: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "audio/mpeg",
      fileName: `${sanitizeFileName(input.targetHint ?? input.wordId)}.mp3`,
      audioUrl: result.audioUrl,
    };
  },
};
