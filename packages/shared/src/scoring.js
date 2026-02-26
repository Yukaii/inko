export function normalizeJapaneseInput(input) {
    return input
        .normalize("NFKC")
        .replace(/\s+/g, "")
        .trim();
}
export function scoreTyping(input, expected, fallbackReading, typingMs) {
    const nInput = normalizeJapaneseInput(input);
    const nExpected = normalizeJapaneseInput(expected);
    const nReading = fallbackReading ? normalizeJapaneseInput(fallbackReading) : undefined;
    const correct = nInput === nExpected || (!!nReading && nInput === nReading);
    if (!correct) {
        return 0;
    }
    const base = 70;
    const fastThreshold = 1800;
    const slowThreshold = 7000;
    if (typingMs <= fastThreshold) {
        return 100;
    }
    if (typingMs >= slowThreshold) {
        return base;
    }
    const ratio = (slowThreshold - typingMs) / (slowThreshold - fastThreshold);
    return Math.round(base + ratio * 30);
}
export function scoreListening(confidence) {
    return confidence * 20;
}
export function scoreShape(handwritingCompleted) {
    return handwritingCompleted ? 100 : 0;
}
export function clampStrength(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}
