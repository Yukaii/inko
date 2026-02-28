import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EdgeTTS } from "node-edge-tts";
import type { LanguageCode } from "@inko/shared";

type TtsWordInput = {
  target: string;
  reading?: string;
  language: LanguageCode;
};

export type TtsAudioResult = {
  audio: Buffer;
  contentType: string;
  fileName: string;
};

export type TtsService = {
  synthesizeWordAudio(input: TtsWordInput): Promise<TtsAudioResult>;
};

const DEFAULT_CONTENT_TYPE = "audio/mpeg";

const SPEECH_CONFIG_BY_LANGUAGE: Record<LanguageCode, { voice: string; lang: string }> = {
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
};

function sanitizeFileName(text: string) {
  const trimmed = text.trim().slice(0, 48);
  const normalized = trimmed.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  return normalized || "word";
}

export function getVoiceForLanguage(language: LanguageCode) {
  return SPEECH_CONFIG_BY_LANGUAGE[language]?.voice ?? "en-US-EmmaNeural";
}

export const ttsService: TtsService = {
  async synthesizeWordAudio(input) {
    const tempDir = await mkdtemp(join(tmpdir(), "inko-tts-"));
    const audioPath = join(tempDir, `${randomUUID()}.mp3`);
    const speechConfig = SPEECH_CONFIG_BY_LANGUAGE[input.language] ?? { voice: "en-US-EmmaNeural", lang: "en-US" };
    const tts = new EdgeTTS({
      voice: speechConfig.voice,
      lang: speechConfig.lang,
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      saveSubtitles: false,
    });

    try {
      await tts.ttsPromise(input.target, audioPath);
      const audio = await readFile(audioPath);

      return {
        audio,
        contentType: DEFAULT_CONTENT_TYPE,
        fileName: `${sanitizeFileName(input.target)}.mp3`,
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  },
};
