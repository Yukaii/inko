import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "pre",
  "rp",
  "rt",
  "ruby",
  "s",
  "strong",
  "sub",
  "sup",
  "u",
  "ul",
] as const;

type RichFieldName = "target" | "reading" | "romanization" | "meaning" | "example";
type RichHtmlFields = `${RichFieldName}Html`;

export type RichTextWordFields = {
  [K in RichFieldName]: string;
} & Partial<Record<RichHtmlFields, string | undefined>>;

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {};

export function sanitizeImportedHtml(value: string | undefined | null) {
  if (!value?.trim()) return undefined;

  const sanitized = sanitizeHtml(value, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: [],
    disallowedTagsMode: "discard",
    parser: {
      lowerCaseTags: true,
    },
    transformTags: {
      div: "p",
    },
    textFilter(text: string) {
      return text.replace(/\u00a0/g, " ");
    },
  })
    .replace(/<p>\s*<\/p>/g, "")
    .trim();

  return sanitized || undefined;
}

export function stripHtmlToPlainText(value: string | undefined | null) {
  if (!value) return "";
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildRichTextWordFields(fields: {
  target: string;
  targetHtml?: string;
  reading?: string;
  readingHtml?: string;
  romanization?: string;
  romanizationHtml?: string;
  meaning: string;
  meaningHtml?: string;
  example?: string;
  exampleHtml?: string;
}) {
  return {
    target: fields.target,
    targetHtml: sanitizeImportedHtml(fields.targetHtml),
    reading: fields.reading ?? "",
    readingHtml: sanitizeImportedHtml(fields.readingHtml),
    romanization: fields.romanization ?? "",
    romanizationHtml: sanitizeImportedHtml(fields.romanizationHtml),
    meaning: fields.meaning,
    meaningHtml: sanitizeImportedHtml(fields.meaningHtml),
    example: fields.example ?? "",
    exampleHtml: sanitizeImportedHtml(fields.exampleHtml),
  };
}
