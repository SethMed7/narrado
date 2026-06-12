import { describe, expect, test } from "bun:test";
import { toSpeakable } from "../src/speakable";

describe("empty input", () => {
  test("empty document returns []", () => {
    expect(toSpeakable("")).toEqual([]);
  });

  test("whitespace-only document returns []", () => {
    expect(toSpeakable("  \n\n\t\n")).toEqual([]);
  });

  test("never returns empty or whitespace-only chunks", () => {
    const chunks = toSpeakable("# Hi\n\n![](no-alt.png)\n\n---\n\ntext");
    for (const chunk of chunks) expect(chunk.trim().length).toBeGreaterThan(0);
  });
});

describe("headings", () => {
  test("heading gets a terminal period", () => {
    expect(toSpeakable("# Getting Started")).toEqual(["Getting Started."]);
  });

  test("heading with existing terminal punctuation is unchanged", () => {
    expect(toSpeakable("## Ready?")).toEqual(["Ready?"]);
  });
});

describe("paragraphs and inline content", () => {
  test("link collapses to its visible text", () => {
    expect(toSpeakable("See [the docs](https://example.com/docs) for more.")).toEqual([
      "See the docs for more.",
    ]);
  });

  test("raw URLs are never read", () => {
    const chunks = toSpeakable("Visit https://example.com/some/long/path today.");
    expect(chunks).toEqual(["Visit today."]);
    expect(chunks.join(" ")).not.toContain("http");
  });

  test("image becomes its alt text", () => {
    expect(toSpeakable("Look at ![a sleepy cat](cat.png) here.")).toEqual([
      "Look at a sleepy cat here.",
    ]);
  });

  test("image without alt is dropped", () => {
    expect(toSpeakable("![](cat.png)")).toEqual([]);
  });

  test("emphasis, strong and inline code collapse to visible text", () => {
    expect(toSpeakable("Run `bun test` with *care* and **focus**.")).toEqual([
      "Run bun test with care and focus.",
    ]);
  });
});

describe("code blocks", () => {
  test("fenced code is skipped by default", () => {
    const md = "Before.\n\n```js\nconst x = 1;\n```\n\nAfter.";
    expect(toSpeakable(md)).toEqual(["Before.", "Code block skipped.", "After."]);
  });

  test("fenced code is read when readCodeBlocks is true", () => {
    const md = "```js\nconst x = 1;\n```";
    expect(toSpeakable(md, { readCodeBlocks: true })).toEqual(["const x = 1;"]);
  });

  test("consecutive skipped code blocks collapse into one chunk", () => {
    const md = "Intro.\n\n```js\na();\n```\n\n```py\nb()\n```\n\nOutro.";
    expect(toSpeakable(md)).toEqual(["Intro.", "Code block skipped.", "Outro."]);
  });

  test("non-consecutive code blocks each get their own marker", () => {
    const md = "```\na\n```\n\nMiddle.\n\n```\nb\n```";
    expect(toSpeakable(md)).toEqual(["Code block skipped.", "Middle.", "Code block skipped."]);
  });
});

describe("GFM tables", () => {
  test("one chunk per body row with header labels", () => {
    const md = ["| Name | Age |", "| --- | --- |", "| Ann | 30 |", "| Bob | 41 |"].join("\n");
    expect(toSpeakable(md)).toEqual(["Name: Ann. Age: 30.", "Name: Bob. Age: 41."]);
  });

  test("rows with empty header labels read cells separated by periods", () => {
    const md = ["| | |", "| --- | --- |", "| left | right |"].join("\n");
    expect(toSpeakable(md)).toEqual(["left. right."]);
  });
});

describe("lists", () => {
  test("each item is its own sentence with a terminal period", () => {
    expect(toSpeakable("- alpha\n- beta!\n- gamma")).toEqual(["alpha.", "beta!", "gamma."]);
  });

  test("nested lists keep order and emit each item separately", () => {
    const md = "- one\n- two\n  - two a\n  - two b\n- three";
    expect(toSpeakable(md)).toEqual(["one.", "two.", "two a.", "two b.", "three."]);
  });

  test("ordered lists work the same way", () => {
    expect(toSpeakable("1. first\n2. second")).toEqual(["first.", "second."]);
  });
});

describe("blockquotes", () => {
  test("blockquote inner text is read with the same rules", () => {
    expect(toSpeakable("> Stay [curious](https://x.com) always.")).toEqual([
      "Stay curious always.",
    ]);
  });

  test("blockquote containing a heading and a list", () => {
    expect(toSpeakable("> # Note\n> - item")).toEqual(["Note.", "item."]);
  });
});

describe("skipped node types", () => {
  test("thematic breaks, html and definitions are silent", () => {
    const md = "Top.\n\n---\n\n<div>hidden</div>\n\n[ref]: https://example.com\n\nBottom.";
    expect(toSpeakable(md)).toEqual(["Top.", "Bottom."]);
  });
});

describe("long chunk splitting", () => {
  test("long paragraph splits on sentence boundaries, stays <= 400 chars, preserves content", () => {
    const sentences = Array.from(
      { length: 25 },
      (_, i) => `This is sentence number ${i + 1} of a fairly long generated paragraph.`,
    );
    const text = sentences.join(" ");
    const chunks = toSpeakable(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(400);
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
    expect(chunks.join(" ")).toBe(text);
  });

  test("split chunks preserve document order around other blocks", () => {
    const long = Array.from({ length: 20 }, (_, i) => `Sentence ${i + 1} keeps going on.`).join(" ");
    const chunks = toSpeakable(`# Title\n\n${long}\n\nThe end.`);
    expect(chunks[0]).toBe("Title.");
    expect(chunks[chunks.length - 1]).toBe("The end.");
    expect(chunks.slice(1, -1).join(" ")).toBe(long);
  });
});
