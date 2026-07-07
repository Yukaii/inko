import JSZip from "jszip";
// @ts-expect-error jsdom is available from the web test environment dependencies, but this repo does not ship its type package.
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vite-plus/test";
import { extractReadingFileFromFile, extractReadingParagraphsFromFile, splitReadingParagraphs } from "./readingUtils";

globalThis.DOMParser = new JSDOM("").window.DOMParser;

describe("reading utils", () => {
  it("splits plain text on blank lines", () => {
    expect(splitReadingParagraphs("第一段。\nstill first.\n\nSecond paragraph.")).toEqual([
      {
        id: "p-1",
        source: "第一段。\nstill first.",
        sentences: [
          { id: "p-1-s-1", text: "第一段。", index: 0 },
          { id: "p-1-s-2", text: "still first.", index: 1 },
        ],
      },
      {
        id: "p-2",
        source: "Second paragraph.",
        sentences: [{ id: "p-2-s-1", text: "Second paragraph.", index: 0 }],
      },
    ]);
  });

  it("treats single-line text exports as one paragraph per line", () => {
    expect(splitReadingParagraphs("Line one\nLine two\n\nLine three")).toEqual([
      {
        id: "p-1",
        source: "Line one\nLine two",
        sentences: [{ id: "p-1-s-1", text: "Line one\nLine two", index: 0 }],
      },
      { id: "p-2", source: "Line three", sentences: [{ id: "p-2-s-1", text: "Line three", index: 0 }] },
    ]);
  });

  it("extracts epub paragraphs in spine order", async () => {
    const zip = new JSZip();
    zip.file(
      "META-INF/container.xml",
      `<?xml version="1.0"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles>
          <rootfile full-path="OPS/content.opf" media-type="application/oebps-package+xml" />
        </rootfiles>
      </container>`,
    );
    zip.file(
      "OPS/content.opf",
      `<?xml version="1.0"?>
      <package xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Japanese Reader</dc:title>
          <dc:creator>Example Author</dc:creator>
          <dc:language>ja-JP</dc:language>
        </metadata>
        <manifest>
          <item id="chapter-two" href="chapter2.xhtml" media-type="application/xhtml+xml" />
          <item id="chapter-one" href="chapter1.xhtml" media-type="application/xhtml+xml" />
        </manifest>
        <spine>
          <itemref idref="chapter-one" />
          <itemref idref="chapter-two" />
        </spine>
      </package>`,
    );
    zip.file("OPS/chapter1.xhtml", "<html><body><p>First chapter.</p></body></html>");
    zip.file("OPS/chapter2.xhtml", "<html><body><p>Second chapter.</p></body></html>");

    const blob = await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
    const paragraphs = await extractReadingParagraphsFromFile(new File([blob], "book.epub", { type: "application/epub+zip" }));

    expect(paragraphs).toEqual([
      {
        id: "chapter-1-p-1",
        source: "First chapter.",
        sentences: [{ id: "chapter-1-p-1-s-1", text: "First chapter.", index: 0 }],
        chapterId: "chapter-1",
        chapterTitle: "Chapter 1",
        chapterIndex: 0,
      },
      {
        id: "chapter-2-p-1",
        source: "Second chapter.",
        sentences: [{ id: "chapter-2-p-1-s-1", text: "Second chapter.", index: 0 }],
        chapterId: "chapter-2",
        chapterTitle: "Chapter 2",
        chapterIndex: 1,
      },
    ]);
  });

  it("extracts epub metadata for import defaults", async () => {
    const zip = new JSZip();
    zip.file(
      "META-INF/container.xml",
      `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" /></rootfiles></container>`,
    );
    zip.file(
      "content.opf",
      `<package xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>韓国語の短編</dc:title>
          <dc:creator>Writer</dc:creator>
          <dc:language>ko-KR</dc:language>
        </metadata>
        <manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml" /></manifest>
        <spine><itemref idref="chapter" /></spine>
      </package>`,
    );
    zip.file("chapter.xhtml", "<html><body><p>첫 문장입니다.</p></body></html>");

    const blob = await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
    const extraction = await extractReadingFileFromFile(new File([blob], "reader.epub", { type: "application/epub+zip" }));

    expect(extraction.metadata).toEqual({
      title: "韓国語の短編",
      author: "Writer",
      language: "ko",
    });
    expect(extraction.paragraphs).toEqual([
      {
        id: "chapter-1-p-1",
        source: "첫 문장입니다.",
        sentences: [{ id: "chapter-1-p-1-s-1", text: "첫 문장입니다.", index: 0 }],
        chapterId: "chapter-1",
        chapterTitle: "Chapter 1",
        chapterIndex: 0,
      },
    ]);
  });

  it("filters Project Gutenberg title-page boilerplate from epub content", async () => {
    const zip = new JSZip();
    zip.file(
      "META-INF/container.xml",
      `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" /></rootfiles></container>`,
    );
    zip.file(
      "content.opf",
      `<package xmlns="http://www.idpf.org/2007/opf">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>ABC: Petits Contes</dc:title>
          <dc:creator>Jules Lemaître</dc:creator>
          <dc:language>fr</dc:language>
        </metadata>
        <manifest><item id="title-page" href="title.xhtml" media-type="application/xhtml+xml" /></manifest>
        <spine><itemref idref="title-page" /></spine>
      </package>`,
    );
    zip.file(
      "title.xhtml",
      `<html><body>
        <h1>The Project Gutenberg eBook of ABC: Petits Contes</h1>
        <p>Title: ABC: Petits Contes</p>
        <p>Author: Jules Lemaître</p>
        <p>Il était une fois un petit enfant.</p>
      </body></html>`,
    );

    const blob = await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
    const extraction = await extractReadingFileFromFile(new File([blob], "petits-contes.epub", { type: "application/epub+zip" }));

    expect(extraction.metadata.title).toBe("ABC: Petits Contes");
    expect(extraction.metadata.author).toBe("Jules Lemaître");
    expect(extraction.metadata.language).toBe("fr");
    expect(extraction.paragraphs).toEqual([
      {
        id: "chapter-1-p-1",
        source: "Il était une fois un petit enfant.",
        sentences: [{ id: "chapter-1-p-1-s-1", text: "Il était une fois un petit enfant.", index: 0 }],
        chapterId: "chapter-1",
        chapterTitle: "Chapter 1",
        chapterIndex: 0,
      },
    ]);
  });
});
