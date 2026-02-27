const ROMAJI_TO_HIRAGANA = {
    kya: "きゃ",
    kyu: "きゅ",
    kyo: "きょ",
    gya: "ぎゃ",
    gyu: "ぎゅ",
    gyo: "ぎょ",
    sha: "しゃ",
    shu: "しゅ",
    sho: "しょ",
    ja: "じゃ",
    ju: "じゅ",
    jo: "じょ",
    cha: "ちゃ",
    chu: "ちゅ",
    cho: "ちょ",
    nya: "にゃ",
    nyu: "にゅ",
    nyo: "にょ",
    hya: "ひゃ",
    hyu: "ひゅ",
    hyo: "ひょ",
    bya: "びゃ",
    byu: "びゅ",
    byo: "びょ",
    pya: "ぴゃ",
    pyu: "ぴゅ",
    pyo: "ぴょ",
    mya: "みゃ",
    myu: "みゅ",
    myo: "みょ",
    rya: "りゃ",
    ryu: "りゅ",
    ryo: "りょ",
    tsu: "つ",
    shi: "し",
    chi: "ち",
    fu: "ふ",
    ka: "か",
    ki: "き",
    ku: "く",
    ke: "け",
    ko: "こ",
    ga: "が",
    gi: "ぎ",
    gu: "ぐ",
    ge: "げ",
    go: "ご",
    sa: "さ",
    su: "す",
    se: "せ",
    so: "そ",
    za: "ざ",
    zi: "じ",
    zu: "ず",
    ze: "ぜ",
    zo: "ぞ",
    ta: "た",
    ti: "ち",
    tu: "つ",
    te: "て",
    to: "と",
    da: "だ",
    di: "ぢ",
    du: "づ",
    de: "で",
    do: "ど",
    na: "な",
    ni: "に",
    nu: "ぬ",
    ne: "ね",
    no: "の",
    ha: "は",
    hi: "ひ",
    hu: "ふ",
    he: "へ",
    ho: "ほ",
    ba: "ば",
    bi: "び",
    bu: "ぶ",
    be: "べ",
    bo: "ぼ",
    pa: "ぱ",
    pi: "ぴ",
    pu: "ぷ",
    pe: "ぺ",
    po: "ぽ",
    ma: "ま",
    mi: "み",
    mu: "む",
    me: "め",
    mo: "も",
    ya: "や",
    yu: "ゆ",
    yo: "よ",
    ra: "ら",
    ri: "り",
    ru: "る",
    re: "れ",
    ro: "ろ",
    wa: "わ",
    wo: "を",
    nn: "ん",
    n: "ん",
    a: "あ",
    i: "い",
    u: "う",
    e: "え",
    o: "お",
};
function normalizeRomajiInput(input) {
    return normalizeJapaneseInput(input).toLowerCase();
}
export function normalizeTypingInput(input) {
    return input
        .normalize("NFKC")
        .replace(/\s+/g, "")
        .trim()
        .toLowerCase();
}
function isConsonant(char) {
    return /[bcdfghjklmnpqrstvwxyz]/.test(char);
}
export function romajiToHiragana(input) {
    const source = normalizeRomajiInput(input);
    let index = 0;
    let output = "";
    while (index < source.length) {
        const char = source[index] ?? "";
        const next = source[index + 1];
        if (char === "-") {
            index += 1;
            continue;
        }
        if (next && char === next && isConsonant(char) && char !== "n") {
            output += "っ";
            index += 1;
            continue;
        }
        if (char === "n") {
            if (!next) {
                output += "ん";
                index += 1;
                continue;
            }
            if (next === "'" || (isConsonant(next) && next !== "y")) {
                output += "ん";
                index += next === "'" ? 2 : 1;
                continue;
            }
        }
        const tri = source.slice(index, index + 3);
        if (ROMAJI_TO_HIRAGANA[tri]) {
            output += ROMAJI_TO_HIRAGANA[tri];
            index += 3;
            continue;
        }
        const duo = source.slice(index, index + 2);
        if (ROMAJI_TO_HIRAGANA[duo]) {
            output += ROMAJI_TO_HIRAGANA[duo];
            index += 2;
            continue;
        }
        if (ROMAJI_TO_HIRAGANA[char]) {
            output += ROMAJI_TO_HIRAGANA[char];
            index += 1;
            continue;
        }
        output += char;
        index += 1;
    }
    return output;
}
export function isJapaneseTypingMatch(input, expected, fallbackReading, romanization) {
    return isTypingMatch(input, expected, fallbackReading, romanization, "ja", "language_specific");
}
export function getTypingMatchTarget(expected, fallbackReading, romanization, language = "ja", typingMode = "language_specific") {
    const languageSpecificJapanese = language === "ja" && typingMode === "language_specific";
    if (languageSpecificJapanese) {
        if (romanization)
            return normalizeRomajiInput(romanization);
        if (fallbackReading)
            return normalizeJapaneseInput(fallbackReading);
        return normalizeJapaneseInput(expected);
    }
    if (romanization)
        return normalizeTypingInput(romanization);
    if (fallbackReading)
        return normalizeTypingInput(fallbackReading);
    return normalizeTypingInput(expected);
}
export function getTypingMatchSource(input, fallbackReading, romanization, language = "ja", typingMode = "language_specific") {
    const languageSpecificJapanese = language === "ja" && typingMode === "language_specific";
    if (languageSpecificJapanese) {
        const typedRomaji = normalizeRomajiInput(input);
        if (romanization)
            return typedRomaji;
        if (fallbackReading)
            return romajiToHiragana(typedRomaji);
        return normalizeJapaneseInput(input);
    }
    return normalizeTypingInput(input);
}
export function isTypingMatch(input, expected, fallbackReading, romanization, language = "ja", typingMode = "language_specific") {
    const source = getTypingMatchSource(input, fallbackReading, romanization, language, typingMode);
    const target = getTypingMatchTarget(expected, fallbackReading, romanization, language, typingMode);
    return source === target;
}
export function normalizeJapaneseInput(input) {
    return input
        .normalize("NFKC")
        .replace(/\s+/g, "")
        .trim();
}
export function scoreTyping(input, expected, fallbackReading, romanization, typingMs, language = "ja", typingMode = "language_specific") {
    const correct = isTypingMatch(input, expected, fallbackReading, romanization, language, typingMode);
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
