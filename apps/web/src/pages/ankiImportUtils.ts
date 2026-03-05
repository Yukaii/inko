import { sanitizeImportedHtml, stripHtmlToPlainText, type CreateWordInput } from "@inko/shared";
import JSZip from "jszip";
import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

export const IMPORTABLE_FIELDS = ["target", "reading", "meaning", "romanization", "example", "audioUrl", "tags", "skip"] as const;

export type ImportableField = (typeof IMPORTABLE_FIELDS)[number];

export type ImportDataset = {
  sourceName: string;
  headers: string[];
  rows: string[][];
};

export type AnkiPackageDataset = {
  sourceName: string;
  suggestedDeckName: string;
  mediaFiles: Map<string, { filename: string; contentType: string; blob: Blob }>;
  noteTypes: Array<{
    id: string;
    name: string;
    headers: string[];
    rows: string[][];
  }>;
};

const HEADER_HINTS: Record<Exclude<ImportableField, "skip">, string[]> = {
  target: ["target", "front", "expression", "term", "word", "kanji", "hanzi", "back?no", "vocab"],
  reading: ["reading", "kana", "furigana", "pronunciation", "pinyin"],
  meaning: ["meaning", "definition", "gloss", "translation", "english", "back"],
  romanization: ["romanization", "romaji", "romanized", "latin", "transliteration"],
  example: ["example", "sentence", "usage", "context", "sample"],
  audioUrl: ["audio", "sound", "voice", "mp3", "tts", "pronunciationaudio"],
  tags: ["tags", "tag", "labels", "topics"],
};
const ANKI_SOUND_TAG_PATTERN = /\[sound:([^\]]+)\]/gi;
const HTML_BREAK_TAG_PATTERN = /<(?:br|\/div|\/p|\/li|\/tr|\/table|div|p|li|tr|table|ul|\/ul|ol|\/ol|hr)\b[^>]*>/gi;
const HTML_TAG_PATTERN = /<[^>]+>/g;
const HTML_MEDIA_SRC_PATTERN = /<(?:audio|source|video|img)\b[^>]*?\ssrc=(["'])(.*?)\1[^>]*>/gi;
const HTML_ENTITY_PATTERN = /&(#x?[0-9a-f]+|[a-z]+);/gi;

const HTML_ENTITY_REPLACEMENTS: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  result.push(current.trim());
  return result;
}

function detectDelimiter(line: string) {
  const tabCount = line.split("\t").length;
  const commaCount = parseCsvLine(line).length;
  return tabCount > commaCount ? "\t" : ",";
}

export function parseDelimitedImport(sourceName: string, text: string): ImportDataset | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ""))
    .filter(Boolean);

  if (lines.length < 2) return null;

  const delimiter = detectDelimiter(lines[0]);
  const parser = delimiter === "\t" ? (line: string) => line.split("\t").map((value) => value.trim()) : parseCsvLine;
  const parsed = lines.map(parser);

  return {
    sourceName,
    headers: parsed[0] ?? [],
    rows: parsed.slice(1),
  };
}

export function inferFieldMapping(headers: string[]) {
  const used = new Set<ImportableField>();

  return headers.map((header, index) => {
    const normalized = normalizeHeader(header || `column${index + 1}`);
    for (const [field, hints] of Object.entries(HEADER_HINTS) as Array<[Exclude<ImportableField, "skip">, string[]]>) {
      if (used.has(field)) continue;
      if (hints.some((hint) => normalized.includes(hint))) {
        used.add(field);
        return field;
      }
    }
    return "skip" as const;
  });
}

function splitTags(value: string | undefined) {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function extractAnkiSoundReferences(value: string | undefined | null) {
  if (!value) return [];
  const references: string[] = [];
  for (const match of value.matchAll(ANKI_SOUND_TAG_PATTERN)) {
    const filename = match[1]?.trim();
    if (filename) references.push(filename);
  }
  return references;
}

export function extractPrimaryAnkiSoundReference(value: string | undefined | null) {
  return extractImportedAudioReferences(value)[0];
}

function decodeHtmlEntities(value: string) {
  return value.replace(HTML_ENTITY_PATTERN, (entity, token: string) => {
    const named = HTML_ENTITY_REPLACEMENTS[token.toLowerCase()];
    if (named) return named;

    const isHex = token[0] === "#" && token[1]?.toLowerCase() === "x";
    const isNumeric = token[0] === "#";
    if (!isNumeric) return entity;

    const codePoint = Number.parseInt(token.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    if (!Number.isFinite(codePoint)) return entity;
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return entity;
    }
  });
}

function cleanImportedText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractEmbeddedMediaReferences(value: string | undefined | null) {
  if (!value) return [];
  const references: string[] = [];
  for (const match of value.matchAll(HTML_MEDIA_SRC_PATTERN)) {
    const source = decodeHtmlEntities(match[2] ?? "").trim();
    if (source) references.push(source);
  }
  return references;
}

function isAudioReference(value: string) {
  return /\.(mp3|wav|ogg|oga|m4a|aac|flac)(?:$|\?)/i.test(value);
}

export function extractImportedAudioReferences(value: string | undefined | null) {
  return [
    ...extractAnkiSoundReferences(value),
    ...extractEmbeddedMediaReferences(value).filter(isAudioReference),
  ];
}

export function normalizeImportedFieldText(value: string | undefined | null) {
  if (!value) return "";

  const stripped = decodeHtmlEntities(
    value
      .replace(ANKI_SOUND_TAG_PATTERN, " ")
      .replace(HTML_MEDIA_SRC_PATTERN, " ")
      .replace(/<rt\b[^>]*>.*?<\/rt>/gi, "")
      .replace(HTML_BREAK_TAG_PATTERN, "\n")
      .replace(HTML_TAG_PATTERN, " ")
      .replace(/\u00a0/g, " "),
  );
  return cleanImportedText(stripHtmlToPlainText(stripped)).replace(/([^\x00-\x7F])\s+([^\x00-\x7F])/g, "$1$2");
}

export function sanitizeImportedFieldHtml(value: string | undefined | null) {
  if (!value) return undefined;
  if (!/[<][a-z!/]|&[a-z#0-9]+;/i.test(value)) return undefined;
  return sanitizeImportedHtml(value.replace(ANKI_SOUND_TAG_PATTERN, " ").replace(HTML_MEDIA_SRC_PATTERN, " "));
}

export function formatImportedFieldPreview(value: string | undefined | null) {
  const text = normalizeImportedFieldText(value);
  const audioReferences = extractImportedAudioReferences(value).map((reference) => reference.split(/[\\/]/).at(-1) ?? reference);
  const embeddedMedia = extractEmbeddedMediaReferences(value)
    .filter((reference) => !isAudioReference(reference))
    .map((reference) => reference.split(/[\\/]/).at(-1) ?? reference);

  const parts = [text];
  if (audioReferences.length > 0) parts.push(audioReferences.map((reference) => `[audio: ${reference}]`).join(" "));
  if (embeddedMedia.length > 0) parts.push(embeddedMedia.map((reference) => `[media: ${reference}]`).join(" "));
  return cleanImportedText(parts.filter(Boolean).join("\n"));
}

function inferMediaContentType(filename: string) {
  const normalized = filename.toLowerCase();
  if (normalized.endsWith(".mp3")) return "audio/mpeg";
  if (normalized.endsWith(".wav")) return "audio/wav";
  if (normalized.endsWith(".ogg") || normalized.endsWith(".oga")) return "audio/ogg";
  if (normalized.endsWith(".m4a")) return "audio/mp4";
  if (normalized.endsWith(".aac")) return "audio/aac";
  if (normalized.endsWith(".flac")) return "audio/flac";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".gif")) return "image/gif";
  if (normalized.endsWith(".webp")) return "image/webp";
  if (normalized.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

export function buildWordsFromMapping(dataset: ImportDataset, mapping: ImportableField[]) {
  const indexFor = (field: Exclude<ImportableField, "skip">) => mapping.findIndex((mapped) => mapped === field);

  const targetIndex = indexFor("target");
  const meaningIndex = indexFor("meaning");
  const readingIndex = indexFor("reading");
  const romanizationIndex = indexFor("romanization");
  const exampleIndex = indexFor("example");
  const audioUrlIndex = indexFor("audioUrl");
  const tagsIndex = indexFor("tags");

  return dataset.rows
    .map((row) => {
      const rawAudioValue = audioUrlIndex >= 0 ? row[audioUrlIndex] : undefined;
      const normalizedAudioValue = normalizeImportedFieldText(rawAudioValue);
      const extractedAudioReference = extractImportedAudioReferences(rawAudioValue)[0];
      const rawTarget = row[targetIndex];
      const rawMeaning = row[meaningIndex];
      const rawReading = readingIndex >= 0 ? row[readingIndex] : undefined;
      const rawRomanization = romanizationIndex >= 0 ? row[romanizationIndex] : undefined;
      const rawExample = exampleIndex >= 0 ? row[exampleIndex] : undefined;
      const word: CreateWordInput = {
        target: normalizeImportedFieldText(rawTarget),
        targetHtml: sanitizeImportedFieldHtml(rawTarget),
        meaning: normalizeImportedFieldText(rawMeaning),
        meaningHtml: sanitizeImportedFieldHtml(rawMeaning),
        reading: readingIndex >= 0 ? normalizeImportedFieldText(rawReading) || undefined : undefined,
        readingHtml: sanitizeImportedFieldHtml(rawReading),
        romanization: romanizationIndex >= 0 ? normalizeImportedFieldText(rawRomanization) || undefined : undefined,
        romanizationHtml: sanitizeImportedFieldHtml(rawRomanization),
        example: exampleIndex >= 0 ? normalizeImportedFieldText(rawExample) || undefined : undefined,
        exampleHtml: sanitizeImportedFieldHtml(rawExample),
        audioUrl: extractedAudioReference || normalizedAudioValue || undefined,
        tags: tagsIndex >= 0 ? splitTags(normalizeImportedFieldText(row[tagsIndex])) : [],
      };
      return word;
    })
    .filter((word) => word.target.trim() && word.meaning.trim());
}

type SqlJsModule = Awaited<ReturnType<typeof initSqlJs>>;

let sqlModulePromise: Promise<SqlJsModule> | null = null;

async function getSqlModule() {
  sqlModulePromise ??= initSqlJs({
    locateFile: () => sqlWasmUrl,
  });
  return sqlModulePromise;
}

type AnkiModel = {
  id?: number;
  name?: string;
  flds?: Array<{ name?: string }>;
};

export async function parseAnkiPackage(file: File): Promise<AnkiPackageDataset> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const collectionEntry =
    zip.file("collection.anki21") ??
    zip.file("collection.anki21b") ??
    zip.file("collection.anki2");

  if (!collectionEntry) {
    throw new Error("No Anki collection database was found in this package.");
  }

  const SQL = await getSqlModule();
  const database = new SQL.Database(new Uint8Array(await collectionEntry.async("uint8array")));

  try {
    const modelsResult = database.exec("SELECT models, decks FROM col LIMIT 1");
    const modelsJson = String(modelsResult[0]?.values?.[0]?.[0] ?? "{}");
    const decksJson = String(modelsResult[0]?.values?.[0]?.[1] ?? "{}");
    const parsedModels = JSON.parse(modelsJson) as Record<string, AnkiModel>;
    const parsedDecks = JSON.parse(decksJson) as Record<string, { name?: string }>;
    const suggestedDeckName =
      Object.values(parsedDecks)
        .map((deck) => deck.name?.split("::").at(-1)?.trim())
        .find(Boolean) ??
      file.name.replace(/\.(apkg|colpkg)$/i, "");

    const rowsResult = database.exec("SELECT mid, flds, tags FROM notes");
    const values = rowsResult[0]?.values ?? [];
    const noteTypes = new Map<string, { id: string; name: string; headers: string[]; rows: string[][] }>();
    const referencedMedia = new Set<string>();

    for (const row of values) {
      const modelId = String(row[0] ?? "");
      const fieldsValue = String(row[1] ?? "");
      const tagsValue = String(row[2] ?? "");
      const model = parsedModels[modelId] ?? parsedModels[String(Number(modelId))];
      if (!model) continue;

      const headers = (model.flds ?? []).map((field, index) => field.name?.trim() || `Field ${index + 1}`);
      const noteType = noteTypes.get(modelId) ?? {
        id: modelId,
        name: model.name?.trim() || "Unnamed note type",
        headers: [...headers, "Anki Tags"],
        rows: [],
      };

      const noteFields = fieldsValue.split("\u001f");
      for (const fieldValue of noteFields) {
        for (const mediaFilename of [...extractImportedAudioReferences(fieldValue), ...extractEmbeddedMediaReferences(fieldValue)]) {
          referencedMedia.add(mediaFilename);
        }
      }

      noteType.rows.push([...noteFields, tagsValue.trim()]);
      noteTypes.set(modelId, noteType);
    }

    const sortedNoteTypes = Array.from(noteTypes.values()).sort((left, right) => right.rows.length - left.rows.length);
    if (sortedNoteTypes.length === 0) {
      throw new Error("The package did not contain any notes to import.");
    }

    const mediaFiles = new Map<string, { filename: string; contentType: string; blob: Blob }>();
    const mediaManifestEntry = zip.file("media");
    if (mediaManifestEntry) {
      const mediaManifest = JSON.parse(await mediaManifestEntry.async("text")) as Record<string, string>;
      for (const [archivePath, originalFilename] of Object.entries(mediaManifest)) {
        if (!referencedMedia.has(originalFilename)) continue;
        const mediaEntry = zip.file(archivePath);
        if (!mediaEntry) continue;
        const contentType = inferMediaContentType(originalFilename);
        const bytes = await mediaEntry.async("uint8array");
        const blobBytes = bytes.slice();
        mediaFiles.set(originalFilename, {
          filename: originalFilename.split(/[\\/]/).at(-1) ?? originalFilename,
          contentType,
          blob: new Blob([blobBytes.buffer], { type: contentType }),
        });
      }
    }

    return {
      sourceName: file.name,
      suggestedDeckName,
      mediaFiles,
      noteTypes: sortedNoteTypes,
    };
  } finally {
    database.close();
  }
}
