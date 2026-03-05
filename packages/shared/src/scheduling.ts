import { clampStrength } from "./scoring";
import { DEFAULT_SRS_CONFIG, type SrsConfig } from "./schemas";

export type ChannelState = {
  strength: number;
  dueAt: number;
};

export type WordChannelStats = {
  shape: ChannelState;
  typing: ChannelState;
  listening: ChannelState;
};

const MINUTE = 60 * 1000;

function intervalByStrength(strength: number, config: SrsConfig): number {
  if (strength < 35) return config.intervalLowMinutes * MINUTE;
  if (strength < 55) return config.intervalMidMinutes * MINUTE;
  if (strength < 70) return config.intervalStrongMinutes * MINUTE;
  if (strength < 85) return config.intervalMasteredMinutes * MINUTE;
  return config.intervalExpertMinutes * MINUTE;
}

function nextStrength(current: number, score: number, config: SrsConfig): number {
  const delta = Math.round((score - 60) / config.strengthStepDivisor);
  return clampStrength(current + delta);
}

export function applyAttempt(
  current: WordChannelStats,
  scores: { shape: number; typing: number; listening: number },
  now: number,
  config: SrsConfig = DEFAULT_SRS_CONFIG,
): WordChannelStats {
  const shapeStrength = nextStrength(current.shape.strength, scores.shape, config);
  const typingStrength = nextStrength(current.typing.strength, scores.typing, config);
  const listeningStrength = nextStrength(current.listening.strength, scores.listening, config);

  return {
    shape: {
      strength: shapeStrength,
      dueAt: now + intervalByStrength(shapeStrength, config),
    },
    typing: {
      strength: typingStrength,
      dueAt: now + intervalByStrength(typingStrength, config),
    },
    listening: {
      strength: listeningStrength,
      dueAt: now + intervalByStrength(listeningStrength, config),
    },
  };
}

export function weakestChannel(stats: WordChannelStats): "shape" | "typing" | "listening" {
  const arr: Array<["shape" | "typing" | "listening", number]> = [
    ["shape", stats.shape.strength],
    ["typing", stats.typing.strength],
    ["listening", stats.listening.strength],
  ];

  arr.sort((a, b) => a[1] - b[1]);
  return arr[0][0];
}

export function nextDueAt(stats: WordChannelStats): number {
  return Math.min(stats.shape.dueAt, stats.typing.dueAt, stats.listening.dueAt);
}

export function defaultWordChannelStats(now: number, config: SrsConfig = DEFAULT_SRS_CONFIG): WordChannelStats {
  return {
    shape: { strength: config.startingStrength, dueAt: now },
    typing: { strength: config.startingStrength, dueAt: now },
    listening: { strength: config.startingStrength, dueAt: now },
  };
}
