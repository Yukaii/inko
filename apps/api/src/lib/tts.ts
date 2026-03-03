import type { LanguageCode } from "@inko/shared";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EdgeTTS } from "node-edge-tts";

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
    const workdir = await mkdtemp(join(tmpdir(), "inko-tts-"));
    const outputPath = join(workdir, `${sanitizeFileName(input.targetHint ?? input.wordId)}.mp3`);
    const edgeTts = new EdgeTTS({
      voice: input.voice ?? "en-US-EmmaNeural",
      rate: input.rate ?? "default",
      pitch: "0Hz",
      volume: "0%",
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
    });
    await edgeTts.ttsPromise(input.targetHint ?? input.wordId, outputPath);
    const audio = await readFile(outputPath);
    await rm(workdir, { recursive: true, force: true });

    return {
      audio,
      contentType: "audio/mpeg",
      fileName: `${sanitizeFileName(input.targetHint ?? input.wordId)}.mp3`,
      audioUrl: "generated-inline",
    };
  },
};
