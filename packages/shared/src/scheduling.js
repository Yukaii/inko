import { clampStrength } from "./scoring.js";
const DAY = 24 * 60 * 60 * 1000;
function intervalByStrength(strength) {
    if (strength < 35)
        return DAY * 0.5;
    if (strength < 55)
        return DAY;
    if (strength < 70)
        return DAY * 2;
    if (strength < 85)
        return DAY * 4;
    return DAY * 7;
}
function nextStrength(current, score) {
    const delta = Math.round((score - 60) / 4);
    return clampStrength(current + delta);
}
export function applyAttempt(current, scores, now) {
    const shapeStrength = nextStrength(current.shape.strength, scores.shape);
    const typingStrength = nextStrength(current.typing.strength, scores.typing);
    const listeningStrength = nextStrength(current.listening.strength, scores.listening);
    return {
        shape: {
            strength: shapeStrength,
            dueAt: now + intervalByStrength(shapeStrength),
        },
        typing: {
            strength: typingStrength,
            dueAt: now + intervalByStrength(typingStrength),
        },
        listening: {
            strength: listeningStrength,
            dueAt: now + intervalByStrength(listeningStrength),
        },
    };
}
export function weakestChannel(stats) {
    const arr = [
        ["shape", stats.shape.strength],
        ["typing", stats.typing.strength],
        ["listening", stats.listening.strength],
    ];
    arr.sort((a, b) => a[1] - b[1]);
    return arr[0][0];
}
export function nextDueAt(stats) {
    return Math.min(stats.shape.dueAt, stats.typing.dueAt, stats.listening.dueAt);
}
export function defaultWordChannelStats(now) {
    return {
        shape: { strength: 50, dueAt: now },
        typing: { strength: 50, dueAt: now },
        listening: { strength: 50, dueAt: now },
    };
}
