import {
  getTypingMatchSource,
  getTypingMatchTarget,
  isTypingMatch,
  type LanguageCode,
  type TypingMode,
} from "@inko/shared";

export type PracticeCard = {
  wordId: string;
  language: LanguageCode;
  target: string;
  reading?: string;
  romanization?: string;
  meaning?: string;
  example?: string;
  audioUrl?: string;
};

export function canSubmitCard(input: {
  typingInput: string;
  expected: string;
  language?: LanguageCode;
  typingMode?: TypingMode;
  reading?: string;
  romanization?: string;
}) {
  return isTypingMatch(
    input.typingInput,
    input.expected,
    input.reading,
    input.romanization,
    input.language ?? "ja",
    input.typingMode ?? "language_specific",
  );
}

export function getTypingFeedback(input: {
  typingInput: string;
  expected: string;
  language?: LanguageCode;
  typingMode?: TypingMode;
  reading?: string;
  romanization?: string;
}) {
  const language = input.language ?? "ja";
  const typingMode = input.typingMode ?? "language_specific";
  const target = getTypingMatchTarget(input.expected, input.reading, input.romanization, language, typingMode);
  const source = getTypingMatchSource(input.typingInput, input.reading, input.romanization, language, typingMode);

  if (!source || !target) {
    return {
      target,
      matchedChars: 0,
      accuracy: 100,
      progress: 0,
      onTrack: true,
      complete: false,
      currentStreak: 0,
    };
  }

  let matchedChars = 0;
  const limit = Math.min(source.length, target.length);
  while (matchedChars < limit && source[matchedChars] === target[matchedChars]) {
    matchedChars += 1;
  }

  const onTrack = target.startsWith(source);
  const complete = source === target;
  const accuracy = source.length === 0 ? 100 : Math.round((matchedChars / source.length) * 100);
  const progress = target.length === 0 ? 0 : Math.min(100, Math.round((matchedChars / target.length) * 100));

  return {
    target,
    matchedChars,
    accuracy,
    progress,
    onTrack,
    complete,
    currentStreak: onTrack ? source.length : 0,
  };
}

export function isEscDoublePress(lastEscPressedAt: number | null, now: number, windowMs = 1000) {
  if (!lastEscPressedAt) return false;
  return now - lastEscPressedAt <= windowMs;
}

export function getNextCleanStreak(previousStreak: number, hadMistake: boolean) {
  return hadMistake ? 0 : previousStreak + 1;
}

export function getPracticeCompletionTitle(input: {
  sessionCapped: boolean;
  cardsCompleted: number;
  sessionTargetCards: number;
  t: (key: string) => string;
}) {
  if (input.sessionCapped || (input.sessionTargetCards > 0 && input.cardsCompleted >= input.sessionTargetCards)) {
    return input.t("practice.daily_target_reached");
  }
  return input.t("practice.session_complete");
}

export function getTtsCacheKey(deckId: string, wordId: string, voice: string, rate: string) {
  return `${deckId}:${wordId}:${voice}:${rate}`;
}

export function getInitialTtsAudioWarmupCards(card: PracticeCard | null, upcomingCards: PracticeCard[] | undefined) {
  return [card, ...(upcomingCards ?? [])].filter((value): value is PracticeCard => value !== null).slice(0, 8);
}
