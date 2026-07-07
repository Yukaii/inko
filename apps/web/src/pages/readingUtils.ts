import JSZip from "jszip";
import type { LanguageCode } from "@inko/shared";

export type ReadingParagraph = {
  id: string;
  source: string;
};

export type ReadingFileMetadata = {
  title?: string;
  author?: string;
  language?: LanguageCode;
};

export type ReadingFileExtraction = {
  paragraphs: ReadingParagraph[];
  metadata: ReadingFileMetadata;
};

const XHTML_FILE_PATTERN = /\.(xhtml|html|htm|xml)$/i;
const PARAGRAPH_BREAK_PATTERN = /\n\s*\n+/;
const LANGUAGE_ALIASES: Record<string, LanguageCode> = {
  ja: "ja",
  jp: "ja",
  ko: "ko",
  kr: "ko",
  zh: "zh",
  chi: "zh",
  zho: "zh",
  cmn: "zh",
  es: "es",
  fr: "fr",
  de: "de",
  it: "it",
  pt: "pt",
  ru: "ru",
  ar: "ar",
  hi: "hi",
  th: "th",
  nl: "nl",
  pl: "pl",
  tr: "tr",
  vi: "vi",
  id: "id",
  uk: "uk",
};

function normalizeWhitespace(value: string) {
  return value.replace(/\r\n?/g, "\n").replace(/[ \t\f\v]+/g, " ").trim();
}

function makeParagraphs(chunks: string[]) {
  return chunks
    .map((chunk) => normalizeWhitespace(chunk))
    .filter(Boolean)
    .map((source, index) => ({
      id: `p-${index + 1}`,
      source,
    }));
}

export function splitReadingParagraphs(text: string): ReadingParagraph[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const chunks = normalized.includes("\n\n")
    ? normalized.split(PARAGRAPH_BREAK_PATTERN)
    : normalized.split("\n").filter((line) => line.trim().length > 0);

  return makeParagraphs(chunks);
}

function extractDocumentParagraphs(markup: string, mimeType: DOMParserSupportedType = "application/xhtml+xml") {
  const parser = new DOMParser();
  const document = parser.parseFromString(markup, mimeType);
  const parseError = document.querySelector("parsererror");
  if (parseError && mimeType !== "text/html") {
    return extractDocumentParagraphs(markup, "text/html");
  }

  const paragraphNodes = Array.from(document.querySelectorAll("p, blockquote, li, h1, h2, h3, h4, h5, h6"));
  const chunks = paragraphNodes.length > 0
    ? paragraphNodes.map((node) => node.textContent ?? "")
    : [(document.body ?? document.documentElement).textContent ?? ""];

  return makeParagraphs(chunks).map((paragraph) => paragraph.source);
}

function resolveRelativePath(basePath: string, relativePath: string) {
  const baseParts = basePath.split("/");
  baseParts.pop();

  for (const part of relativePath.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }

  return baseParts.join("/");
}

function normalizeMetadataLanguage(value: string | undefined): LanguageCode | undefined {
  const normalized = value?.trim().toLowerCase().split(/[-_]/)[0];
  return normalized ? LANGUAGE_ALIASES[normalized] : undefined;
}

function getFirstElementText(document: Document, localName: string) {
  const match = Array.from(document.getElementsByTagName("*")).find((element) => element.localName.toLowerCase() === localName);
  return match?.textContent?.trim() || undefined;
}

async function getEpubPackage(zip: JSZip) {
  const container = await zip.file("META-INF/container.xml")?.async("text");
  if (!container) return null;

  const parser = new DOMParser();
  const containerDocument = parser.parseFromString(container, "application/xml");
  const packagePath = containerDocument.querySelector("rootfile")?.getAttribute("full-path");
  if (!packagePath) return null;

  const packageMarkup = await zip.file(packagePath)?.async("text");
  if (!packageMarkup) return null;

  return {
    packagePath,
    packageDocument: parser.parseFromString(packageMarkup, "application/xml"),
  };
}

function getEpubMetadata(packageDocument: Document): ReadingFileMetadata {
  return {
    title: getFirstElementText(packageDocument, "title"),
    author: getFirstElementText(packageDocument, "creator"),
    language: normalizeMetadataLanguage(getFirstElementText(packageDocument, "language")),
  };
}

function getEpubContentFilePaths(packagePath: string, packageDocument: Document) {
  const manifestById = new Map<string, string>();
  for (const item of Array.from(packageDocument.querySelectorAll("manifest item"))) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    const mediaType = item.getAttribute("media-type") ?? "";
    if (!id || !href) continue;
    if (mediaType.includes("html") || XHTML_FILE_PATTERN.test(href)) {
      manifestById.set(id, resolveRelativePath(packagePath, href));
    }
  }

  return Array.from(packageDocument.querySelectorAll("spine itemref"))
    .map((itemref) => itemref.getAttribute("idref"))
    .filter((idref): idref is string => Boolean(idref))
    .map((idref) => manifestById.get(idref))
    .filter((path): path is string => Boolean(path));
}

export async function extractEpubReading(file: File): Promise<ReadingFileExtraction> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const epubPackage = await getEpubPackage(zip);
  const spinePaths = epubPackage ? getEpubContentFilePaths(epubPackage.packagePath, epubPackage.packageDocument) : [];
  const fallbackPaths = Object.keys(zip.files)
    .filter((path) => !zip.files[path].dir && XHTML_FILE_PATTERN.test(path))
    .sort((a, b) => a.localeCompare(b));
  const contentPaths = spinePaths.length > 0 ? spinePaths : fallbackPaths;

  const chunks: string[] = [];
  for (const path of contentPaths) {
    const entry = zip.file(path);
    if (!entry) continue;
    chunks.push(...extractDocumentParagraphs(await entry.async("text")));
  }

  return {
    paragraphs: makeParagraphs(chunks),
    metadata: epubPackage ? getEpubMetadata(epubPackage.packageDocument) : {},
  };
}

export async function extractEpubParagraphs(file: File): Promise<ReadingParagraph[]> {
  return (await extractEpubReading(file)).paragraphs;
}

export async function extractReadingFileFromFile(file: File): Promise<ReadingFileExtraction> {
  if (/\.epub$/i.test(file.name) || file.type === "application/epub+zip") {
    return extractEpubReading(file);
  }

  return {
    paragraphs: splitReadingParagraphs(await file.text()),
    metadata: {
      title: file.name.replace(/\.[^.]+$/, "") || undefined,
    },
  };
}

export async function extractReadingParagraphsFromFile(file: File): Promise<ReadingParagraph[]> {
  return (await extractReadingFileFromFile(file)).paragraphs;
}
