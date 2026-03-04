import { LANGUAGE_LABELS, type LanguageCode } from "@inko/shared";

type Translate = (key: string, options: { defaultValue: string }) => string;

export function getLanguageLabel(code: LanguageCode, t?: Translate) {
  return t?.(`languages.${code}`, { defaultValue: LANGUAGE_LABELS[code] }) ?? LANGUAGE_LABELS[code];
}
