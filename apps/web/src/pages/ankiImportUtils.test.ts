import { describe, expect, it } from "vite-plus/test";
import {
  buildWordsFromMapping,
  extractAnkiSoundReferences,
  extractImportedAudioReferences,
  inferFieldMapping,
  parseDelimitedImport,
  sanitizeImportedFieldHtml,
} from "./ankiImportUtils";

describe("anki import utils", () => {
  it("parses tab-separated exports", () => {
    const dataset = parseDelimitedImport("sample.tsv", "Front\tReading\tMeaning\n食べる\tたべる\tto eat");
    expect(dataset).not.toBeNull();
    expect(dataset?.headers).toEqual(["Front", "Reading", "Meaning"]);
    expect(dataset?.rows).toEqual([["食べる", "たべる", "to eat"]]);
  });

  it("infers common Anki field names", () => {
    expect(inferFieldMapping(["Expression", "Pronunciation", "English", "Audio", "Tags"])).toEqual([
      "target",
      "reading",
      "meaning",
      "audioUrl",
      "tags",
    ]);
  });

  it("builds words from mapped rows", () => {
    const dataset = parseDelimitedImport(
      "sample.csv",
      "Expression,Meaning,Romaji,Example,Audio,Tags\n食べる,to eat,taberu,私は寿司を食べる。,https://cdn.example/audio.mp3,verb n5",
    );
    expect(dataset).not.toBeNull();
    const words = buildWordsFromMapping(dataset!, ["target", "meaning", "romanization", "example", "audioUrl", "tags"]);
    expect(words).toEqual([
      {
        target: "食べる",
        targetHtml: undefined,
        meaning: "to eat",
        meaningHtml: undefined,
        reading: undefined,
        readingHtml: undefined,
        romanization: "taberu",
        romanizationHtml: undefined,
        example: "私は寿司を食べる。",
        exampleHtml: undefined,
        audioUrl: "https://cdn.example/audio.mp3",
        tags: ["verb", "n5"],
      },
    ]);
  });

  it("preserves safe markup in dedicated html fields while normalizing text", () => {
    const dataset = parseDelimitedImport(
      "sample.tsv",
      "Front\tMeaning\tExample\n<ruby>食<rt>た</rt></ruby>べる\t<p><strong>to eat</strong></p>\t<div>Line 1<br>Line 2</div>",
    );

    const words = buildWordsFromMapping(dataset!, ["target", "meaning", "example"]);
    expect(words).toEqual([
      {
        target: "食べる",
        targetHtml: "<ruby>食<rt>た</rt></ruby>べる",
        reading: undefined,
        readingHtml: undefined,
        romanization: undefined,
        romanizationHtml: undefined,
        meaning: "to eat",
        meaningHtml: "<p><strong>to eat</strong></p>",
        example: "Line 1\nLine 2",
        exampleHtml: "<p>Line 1<br />Line 2</p>",
        audioUrl: undefined,
        tags: [],
      },
    ]);
  });

  it("preserves empty trailing fields when parsing", () => {
    const dataset = parseDelimitedImport("sample.tsv", "Front\tMeaning\tTags\n食べる\tto eat\t");
    expect(dataset?.rows[0]).toEqual(["食べる", "to eat", ""]);
  });

  it("extracts Anki sound references", () => {
    expect(extractAnkiSoundReferences("[sound:first.mp3] hello [sound:folder/second.wav]")).toEqual([
      "first.mp3",
      "folder/second.wav",
    ]);
  });

  it("extracts embedded audio references from html markup", () => {
    expect(extractImportedAudioReferences('<audio controls src="collection.media/voice.mp3"></audio>')).toEqual([
      "collection.media/voice.mp3",
    ]);
  });

  it("sanitizes imported html and removes unsafe markup", () => {
    expect(sanitizeImportedFieldHtml('<p>Hello</p><script>alert(1)</script><img src="evil.png" />')).toBe("<p>Hello</p>");
  });
});
