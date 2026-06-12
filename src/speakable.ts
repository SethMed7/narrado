import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { List, PhrasingContent, Root, RootContent, Table } from "mdast";

const MAX_CHUNK = 400;
const SKIP_MARKER = "Code block skipped.";

export function toSpeakable(markdown: string, opts?: { readCodeBlocks?: boolean }): string[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root;
  const chunks: string[] = [];
  walkBlocks(tree.children, chunks, opts?.readCodeBlocks === true);
  return chunks
    .flatMap(splitChunk)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

function walkBlocks(nodes: RootContent[], out: string[], readCode: boolean): void {
  for (const node of nodes) {
    switch (node.type) {
      case "heading": {
        const text = collapse(node.children);
        if (text) out.push(ensureTerminal(text));
        break;
      }
      case "paragraph": {
        const text = collapse(node.children);
        if (text) out.push(text);
        break;
      }
      case "code": {
        if (readCode) {
          const text = node.value.trim();
          if (text) out.push(text);
        } else if (out[out.length - 1] !== SKIP_MARKER) {
          // Last-chunk check collapses consecutive skipped blocks into one marker.
          out.push(SKIP_MARKER);
        }
        break;
      }
      case "table":
        speakTable(node, out);
        break;
      case "list":
        speakList(node, out, readCode);
        break;
      case "blockquote":
        walkBlocks(node.children, out, readCode);
        break;
      default:
        // thematicBreak, html, definition, footnoteDefinition: skip silently.
        break;
    }
  }
}

function speakList(list: List, out: string[], readCode: boolean): void {
  for (const item of list.children) {
    const own = item.children.filter((child) => child.type !== "list");
    const nested = item.children.filter((child): child is List => child.type === "list");
    const parts: string[] = [];
    walkBlocks(own, parts, readCode);
    const text = parts.join(" ").trim();
    if (text) out.push(ensureTerminal(text));
    for (const sub of nested) speakList(sub, out, readCode);
  }
}

function speakTable(table: Table, out: string[]): void {
  const rows = table.children;
  if (rows.length === 0) return;
  const headers = rows[0]!.children.map((cell) => collapse(cell.children));
  const hasHeader = headers.some((label) => label.length > 0);
  const body = hasHeader ? rows.slice(1) : rows;
  for (const row of body) {
    const cells = row.children.map((cell) => collapse(cell.children));
    let text: string;
    if (hasHeader) {
      text = cells
        .map((cell, i) => {
          if (!cell) return "";
          const label = headers[i];
          return label ? `${label}: ${cell}.` : `${cell}.`;
        })
        .filter(Boolean)
        .join(" ");
    } else {
      const filled = cells.filter(Boolean);
      text = filled.length ? `${filled.join(". ")}.` : "";
    }
    if (text) out.push(text);
  }
}

function collapse(nodes: PhrasingContent[]): string {
  return nodes.map(phrasing).join("").replace(/\s+/g, " ").trim();
}

function phrasing(node: PhrasingContent): string {
  switch (node.type) {
    case "text":
    case "inlineCode":
      return node.value;
    case "image":
    case "imageReference":
      return node.alt ?? "";
    case "link": {
      const text = node.children.map(phrasing).join("");
      // Autolinks/bare URLs read as gibberish; drop any link whose visible text is a URL.
      return /^\s*(https?:\/\/|www\.)/i.test(text) ? "" : text;
    }
    case "break":
      return " ";
    case "footnoteReference":
    case "html":
      return "";
    default:
      return "children" in node ? node.children.map(phrasing).join("") : "";
  }
}

function ensureTerminal(text: string): string {
  return /[.!?:;…]$/.test(text) ? text : `${text}.`;
}

function splitChunk(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text];
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
  const out: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    for (const piece of hardSplit(sentence.trim())) {
      if (!piece) continue;
      if (current && current.length + piece.length + 1 > MAX_CHUNK) {
        out.push(current);
        current = piece;
      } else {
        current = current ? `${current} ${piece}` : piece;
      }
    }
  }
  if (current) out.push(current);
  return out;
}

// A single sentence over the cap (e.g. punctuation-free code read aloud) splits on words.
function hardSplit(sentence: string): string[] {
  if (sentence.length <= MAX_CHUNK) return [sentence];
  const out: string[] = [];
  let current = "";
  for (const word of sentence.split(/\s+/)) {
    if (current && current.length + word.length + 1 > MAX_CHUNK) {
      out.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) out.push(current);
  return out;
}
