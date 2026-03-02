import { describe, expect, it } from "vitest";
import { buildWordsFromMapping, inferFieldMapping, parseDelimitedImport } from "./ankiImportUtils";

describe("anki import utils", () => {
  it("parses tab-separated exports", () => {
    const dataset = parseDelimitedImport("sample.tsv", "Front\tReading\tMeaning\n食べる\tたべる\tto eat");
    expect(dataset).not.toBeNull();
    expect(dataset?.headers).toEqual(["Front", "Reading", "Meaning"]);
    expect(dataset?.rows).toEqual([["食べる", "たべる", "to eat"]]);
  });

  it("infers common Anki field names", () => {
    expect(inferFieldMapping(["Expression", "Pronunciation", "English", "Tags"])).toEqual([
      "target",
      "reading",
      "meaning",
      "tags",
    ]);
  });

  it("builds words from mapped rows", () => {
    const dataset = parseDelimitedImport(
      "sample.csv",
      "Expression,Meaning,Romaji,Example,Tags\n食べる,to eat,taberu,私は寿司を食べる。,verb n5",
    );
    expect(dataset).not.toBeNull();
    const words = buildWordsFromMapping(dataset!, ["target", "meaning", "romanization", "example", "tags"]);
    expect(words).toEqual([
      {
        target: "食べる",
        meaning: "to eat",
        reading: undefined,
        romanization: "taberu",
        example: "私は寿司を食べる。",
        tags: ["verb", "n5"],
      },
    ]);
  });

  it("preserves empty trailing fields when parsing", () => {
    const dataset = parseDelimitedImport("sample.tsv", "Front\tMeaning\tTags\n食べる\tto eat\t");
    expect(dataset?.rows[0]).toEqual(["食べる", "to eat", ""]);
  });
});
