import type { CreateWordInput } from "@inko/shared";

export const DASHBOARD_ONBOARDING_STORAGE_KEY = "inko_dashboard_onboarding_started";

export function shouldShowDashboardOnboarding(input: {
  decksCount: number;
  recentSessionsCount: number;
  hasStartedPracticeFlag: boolean;
}) {
  return input.decksCount === 0 && input.recentSessionsCount === 0 && !input.hasStartedPracticeFlag;
}

export function buildSampleDeckWords(): CreateWordInput[] {
  return [
    { target: "こんにちは", reading: "こんにちは", romanization: "konnichiwa", meaning: "hello", tags: [] },
    { target: "ありがとう", reading: "ありがとう", romanization: "arigatou", meaning: "thank you", tags: [] },
    { target: "さようなら", reading: "さようなら", romanization: "sayounara", meaning: "goodbye", tags: [] },
    { target: "水", reading: "みず", romanization: "mizu", meaning: "water", tags: [] },
    { target: "猫", reading: "ねこ", romanization: "neko", meaning: "cat", tags: [] },
    { target: "学校", reading: "がっこう", romanization: "gakkou", meaning: "school", tags: [] },
  ];
}
