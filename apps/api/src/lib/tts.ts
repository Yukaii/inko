import { getDefaultEdgeTtsVoice, type LanguageCode } from "@inko/shared";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EdgeTTS } from "node-edge-tts";
import { buildReadingTtsObjectKey, buildTtsObjectKey, getObject, hasObject, putObject } from "./object-storage";

export type TtsAudioResult = {
  audio: Buffer;
  contentType: string;
  fileName: string;
  audioUrl: string;
  diagnostics?: {
    objectKey: string;
    source: "cache-hit" | "generated";
    timingsMs: {
      hasObject?: number;
      getObject?: number;
      edgeTts?: number;
      readFile?: number;
      cleanup?: number;
      putObject?: number;
      total: number;
    };
  };
};

type TtsTimings = NonNullable<TtsAudioResult["diagnostics"]>["timingsMs"];

export type TtsService = {
  synthesizeWordAudio(input: {
    userId: string;
    deckId: string;
    wordId: string;
    targetHint?: string;
    voice?: string;
    rate?: "-20%" | "default" | "+20%";
  }): Promise<TtsAudioResult>;
  synthesizeTextAudio(input: {
    userId: string;
    documentId: string;
    paragraphId: string;
    text: string;
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
  return getDefaultEdgeTtsVoice(language);
}

async function synthesizeAudio(input: {
  key: string;
  text: string;
  fileNameHint: string;
  voice?: string;
  rate?: "-20%" | "default" | "+20%";
}): Promise<TtsAudioResult> {
  const totalStartedAt = Date.now();
  const timingsMs: TtsTimings = {
    total: 0,
  };
  const key = input.key;

  const hasObjectStartedAt = Date.now();
  const objectExists = await hasObject(key);
  timingsMs.hasObject = Date.now() - hasObjectStartedAt;
  if (objectExists) {
    const getObjectStartedAt = Date.now();
    const existing = await getObject(key);
    timingsMs.getObject = Date.now() - getObjectStartedAt;
    if (existing) {
      timingsMs.total = Date.now() - totalStartedAt;
      return {
        audio: existing.body,
        contentType: existing.contentType,
        fileName: `${sanitizeFileName(input.fileNameHint)}.mp3`,
        audioUrl: "stored",
        diagnostics: {
          objectKey: key,
          source: "cache-hit",
          timingsMs,
        },
      };
    }
  }

  const workdir = await mkdtemp(join(tmpdir(), "inko-tts-"));
  const outputPath = join(workdir, `${sanitizeFileName(input.fileNameHint)}.mp3`);
  const edgeTts = new EdgeTTS({
    voice: input.voice ?? "en-US-EmmaNeural",
    rate: input.rate ?? "default",
    pitch: "0Hz",
    volume: "0%",
    outputFormat: "audio-24khz-48kbitrate-mono-mp3",
  });
  const edgeTtsStartedAt = Date.now();
  await edgeTts.ttsPromise(input.text, outputPath);
  timingsMs.edgeTts = Date.now() - edgeTtsStartedAt;
  const readFileStartedAt = Date.now();
  const audio = await readFile(outputPath);
  timingsMs.readFile = Date.now() - readFileStartedAt;
  const cleanupStartedAt = Date.now();
  await rm(workdir, { recursive: true, force: true });
  timingsMs.cleanup = Date.now() - cleanupStartedAt;
  const putObjectStartedAt = Date.now();
  await putObject({
    key,
    body: audio,
    contentType: "audio/mpeg",
    cacheControl: "public, max-age=31536000, immutable",
  });
  timingsMs.putObject = Date.now() - putObjectStartedAt;
  timingsMs.total = Date.now() - totalStartedAt;

  return {
    audio,
    contentType: "audio/mpeg",
    fileName: `${sanitizeFileName(input.fileNameHint)}.mp3`,
    audioUrl: "stored",
    diagnostics: {
      objectKey: key,
      source: "generated",
      timingsMs,
    },
  };
}

export const ttsService: TtsService = {
  async synthesizeWordAudio(input) {
    return synthesizeAudio({
      key: buildTtsObjectKey({
        userId: input.userId,
        deckId: input.deckId,
        wordId: input.wordId,
        voice: input.voice ?? "en-US-EmmaNeural",
        rate: input.rate ?? "default",
      }),
      text: input.targetHint ?? input.wordId,
      fileNameHint: input.targetHint ?? input.wordId,
      voice: input.voice,
      rate: input.rate,
    });
  },

  async synthesizeTextAudio(input) {
    return synthesizeAudio({
      key: buildReadingTtsObjectKey({
        userId: input.userId,
        documentId: input.documentId,
        paragraphId: input.paragraphId,
        voice: input.voice ?? "en-US-EmmaNeural",
        rate: input.rate ?? "default",
      }),
      text: input.text,
      fileNameHint: input.text.slice(0, 48) || input.paragraphId,
      voice: input.voice,
      rate: input.rate,
    });
  },
};
