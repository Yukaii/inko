import { describe, expect, it } from "vitest";
import { getVoiceForLanguage } from "./tts";

describe("getVoiceForLanguage", () => {
  it("maps supported practice languages to stable Edge voices", () => {
    expect(getVoiceForLanguage("ja")).toBe("ja-JP-NanamiNeural");
    expect(getVoiceForLanguage("es")).toBe("es-ES-ElviraNeural");
    expect(getVoiceForLanguage("th")).toBe("th-TH-PremwadeeNeural");
    expect(getVoiceForLanguage("nl")).toBe("nl-NL-ColetteNeural");
  });
});
