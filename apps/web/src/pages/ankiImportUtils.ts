import type { CreateWordInput } from "@inko/shared";
import JSZip from "jszip";
import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

export const IMPORTABLE_FIELDS = ["target", "reading", "meaning", "romanization", "example", "tags", "skip"] as const;

export type ImportableField = (typeof IMPORTABLE_FIELDS)[number];

export type ImportDataset = {
  sourceName: string;
  headers: string[];
  rows: string[][];
};

export type AnkiPackageDataset = {
  sourceName: string;
  suggestedDeckName: string;
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
  example: ["example", "sentence", "usage", "context"],
  tags: ["tags", "tag", "labels", "topics"],
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

export function buildWordsFromMapping(dataset: ImportDataset, mapping: ImportableField[]) {
  const indexFor = (field: Exclude<ImportableField, "skip">) => mapping.findIndex((mapped) => mapped === field);

  const targetIndex = indexFor("target");
  const meaningIndex = indexFor("meaning");
  const readingIndex = indexFor("reading");
  const romanizationIndex = indexFor("romanization");
  const exampleIndex = indexFor("example");
  const tagsIndex = indexFor("tags");

  return dataset.rows
    .map((row) => {
      const word: CreateWordInput = {
        target: row[targetIndex] ?? "",
        meaning: row[meaningIndex] ?? "",
        reading: readingIndex >= 0 ? row[readingIndex] || undefined : undefined,
        romanization: romanizationIndex >= 0 ? row[romanizationIndex] || undefined : undefined,
        example: exampleIndex >= 0 ? row[exampleIndex] || undefined : undefined,
        tags: tagsIndex >= 0 ? splitTags(row[tagsIndex]) : [],
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

      noteType.rows.push([...fieldsValue.split("\u001f"), tagsValue.trim()]);
      noteTypes.set(modelId, noteType);
    }

    const sortedNoteTypes = Array.from(noteTypes.values()).sort((left, right) => right.rows.length - left.rows.length);
    if (sortedNoteTypes.length === 0) {
      throw new Error("The package did not contain any notes to import.");
    }

    return {
      sourceName: file.name,
      suggestedDeckName,
      noteTypes: sortedNoteTypes,
    };
  } finally {
    database.close();
  }
}
