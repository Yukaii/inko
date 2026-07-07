import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from "@inko/shared";

export const TRANSLATION_LANGUAGE_OPTIONS = [
  { value: "English", label: "English" },
  ...SUPPORTED_LANGUAGES.map((language) => ({
    value: LANGUAGE_LABELS[language],
    label: LANGUAGE_LABELS[language],
  })),
];
