import { describe, expect, it } from "vite-plus/test";
import { sanitizeImportedHtml, stripHtmlToPlainText } from "./richText";

describe("richText", () => {
  it("keeps safe formatting tags", () => {
    expect(sanitizeImportedHtml("<ruby>学<rt>がく</rt></ruby><strong>校</strong>")).toBe("<ruby>学<rt>がく</rt></ruby><strong>校</strong>");
  });

  it("removes unsafe tags and attributes", () => {
    expect(sanitizeImportedHtml('<p onclick="alert(1)">Hi</p><script>alert(2)</script><img src="x">')).toBe("<p>Hi</p>");
  });

  it("converts html markup to plain text", () => {
    expect(stripHtmlToPlainText("<div>Line 1<br>Line 2&nbsp;</div>")).toBe("Line 1Line 2");
  });
});
