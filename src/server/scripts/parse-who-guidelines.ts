import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";

const INPUT_DIR = path.resolve("data/who-guidelines");
const OUTPUT_FILE = path.resolve("data/who-guideline-chunks.json");
const MAX_CHUNK_TOKENS = 400;
const OVERLAP_TOKENS = 100;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
});

interface Chunk {
  source: string;
  section: string;
  content: string;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function extractText(node: any): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "boolean") return "";
  if (Array.isArray(node)) {
    return node.map(extractText).filter(Boolean).join(" ");
  }
  if (typeof node === "object") {
    const parts: string[] = [];
    for (const [key, val] of Object.entries(node)) {
      if (key.startsWith("@_")) continue;
      if (key === "fig" || key === "graphic") continue;
      parts.push(extractText(val));
    }
    return parts.filter(Boolean).join(" ");
  }
  return "";
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function splitBlock(text: string, maxTokens: number): string[] {
  if (estimateTokens(text) <= maxTokens) return [text];

  const sentences = text.split(/(?<=\.)\s+/);
  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && estimateTokens(current + " " + sentence) > maxTokens) {
      parts.push(current);
      current = sentence;
    } else {
      current = current ? current + " " + sentence : sentence;
    }
  }
  if (current) parts.push(current);

  // If sentence splitting still leaves oversized parts, hard-split by characters
  const result: string[] = [];
  for (const part of parts) {
    if (estimateTokens(part) <= maxTokens) {
      result.push(part);
    } else {
      const charLimit = maxTokens * 4;
      for (let i = 0; i < part.length; i += charLimit) {
        result.push(part.slice(i, i + charLimit));
      }
    }
  }
  return result;
}

function getBookTitle(parsed: any): string {
  const wrapper = parsed["book-part-wrapper"];
  if (!wrapper?.["book-meta"]?.["book-title-group"]?.["book-title"]) return "";
  const title = wrapper["book-meta"]["book-title-group"]["book-title"];
  return typeof title === "string" ? title : cleanText(extractText(title));
}

function getChapterTitle(bookPart: any): string {
  const titleGroup = bookPart?.["book-part-meta"]?.["title-group"];
  if (!titleGroup) return "";
  const label = titleGroup.label;
  const title = titleGroup.title;
  const titleText =
    typeof title === "string" ? title : cleanText(extractText(title));
  if (label && titleText) return `${label}. ${titleText}`;
  return titleText || "";
}

function getSectionTitle(sec: any): string {
  if (!sec?.title) return "";
  if (typeof sec.title === "string") return sec.title;
  if (Array.isArray(sec.title)) {
    return sec.title
      .map((t: any) => (typeof t === "string" ? t : cleanText(extractText(t))))
      .join(" — ");
  }
  return cleanText(extractText(sec.title));
}

function collectTextBlocks(node: any): string[] {
  const blocks: string[] = [];
  for (const [key, val] of Object.entries(node)) {
    if (key === "title" || key === "sec" || key.startsWith("@_")) continue;
    if (key === "fig" || key === "graphic") continue;
    if (key === "p") {
      const pList = Array.isArray(val) ? val : [val];
      for (const p of pList) {
        const text = cleanText(typeof p === "string" ? p : extractText(p));
        if (text) blocks.push(text);
      }
    } else {
      const items = Array.isArray(val) ? val : [val];
      for (const item of items) {
        const text = cleanText(typeof item === "string" ? item : extractText(item));
        if (text) blocks.push(text);
      }
    }
  }
  return blocks;
}

function groupBlocks(
  blocks: string[],
  sectionPath: string,
  source: string,
): Chunk[] {
  if (blocks.length === 0) return [];
  const chunks: Chunk[] = [];
  let current: string[] = [];
  let currentTokens = estimateTokens(sectionPath) + 2;
  let overlap = "";

  for (const block of blocks) {
    const subBlocks = splitBlock(block, MAX_CHUNK_TOKENS);
    for (const sub of subBlocks) {
      const subTokens = estimateTokens(sub);
      if (currentTokens + subTokens > MAX_CHUNK_TOKENS && current.length > 0) {
        const content = current.join("\n\n");
        chunks.push({
          source,
          section: sectionPath,
          content: `${sectionPath}\n\n${content}`,
        });
        // Carry trailing text as overlap into next chunk
        const words = content.split(/\s+/);
        const overlapWords = words.slice(-OVERLAP_TOKENS);
        overlap = overlapWords.join(" ");
        current = overlap ? [overlap] : [];
        currentTokens = estimateTokens(sectionPath) + 2 + estimateTokens(overlap);
      }
      current.push(sub);
      currentTokens += subTokens;
    }
  }

  if (current.length > 0) {
    chunks.push({
      source,
      section: sectionPath,
      content: `${sectionPath}\n\n${current.join("\n\n")}`,
    });
  }
  return chunks;
}

function chunkSection(
  sec: any,
  titleHierarchy: string[],
  source: string,
): Chunk[] {
  const title = getSectionTitle(sec);
  const hierarchy = title ? [...titleHierarchy, title] : titleHierarchy;
  const sectionPath = hierarchy.join(" > ");

  const fullText = cleanText(extractText(sec));
  if (fullText.length < 20) return [];

  // Under limit — single chunk
  if (estimateTokens(fullText) <= MAX_CHUNK_TOKENS) {
    const blocks = collectTextBlocks(sec);
    // Include child section text too since it all fits
    const childSecs = sec.sec;
    if (childSecs) {
      const children = Array.isArray(childSecs) ? childSecs : [childSecs];
      for (const child of children) {
        const childTitle = getSectionTitle(child);
        const childBlocks = collectTextBlocks(child);
        if (childTitle && childBlocks.length > 0) {
          blocks.push(`${childTitle}: ${childBlocks.join(" ")}`);
        } else {
          blocks.push(...childBlocks);
        }
      }
    }
    if (blocks.length === 0) return [];
    return [
      {
        source,
        section: sectionPath,
        content: `${sectionPath}\n\n${blocks.join("\n\n")}`,
      },
    ];
  }

  // Has child sections — recurse into them
  const childSecs = sec.sec;
  if (childSecs) {
    const children = Array.isArray(childSecs) ? childSecs : [childSecs];
    const chunks: Chunk[] = [];

    // Own text (non-sec content) as separate chunk if non-trivial
    const ownBlocks = collectTextBlocks(sec);
    const ownText = ownBlocks.join(" ");
    if (ownText.length > 50) {
      chunks.push(...groupBlocks(ownBlocks, sectionPath, source));
    }

    for (const child of children) {
      chunks.push(...chunkSection(child, hierarchy, source));
    }
    return chunks;
  }

  // Leaf section over limit — split by paragraphs
  return groupBlocks(collectTextBlocks(sec), sectionPath, source);
}

function parseFile(filePath: string): Chunk[] {
  const xml = fs.readFileSync(filePath, "utf-8");
  const parsed = parser.parse(xml);

  const wrapper = parsed["book-part-wrapper"];
  if (!wrapper) return [];

  const bookTitle = getBookTitle(parsed);
  const source = path.basename(filePath, ".nxml");
  const bookPart = wrapper["book-part"] || wrapper["book-app"];
  if (!bookPart?.body) return [];

  const chapterTitle = getChapterTitle(bookPart);
  const body = bookPart.body;

  const titleHierarchy: string[] = [];
  if (bookTitle) titleHierarchy.push(bookTitle);
  if (chapterTitle) titleHierarchy.push(chapterTitle);

  const sections = body.sec;
  if (sections) {
    const secList = Array.isArray(sections) ? sections : [sections];
    const chunks: Chunk[] = [];

    // Body-level non-sec content
    const bodyBlocks = collectTextBlocks(body);
    if (bodyBlocks.join(" ").length > 50) {
      const sectionPath = titleHierarchy.join(" > ");
      chunks.push(...groupBlocks(bodyBlocks, sectionPath, source));
    }

    for (const sec of secList) {
      chunks.push(...chunkSection(sec, titleHierarchy, source));
    }
    return chunks;
  }

  // No sections — treat entire body as one chunk
  const bodyText = cleanText(extractText(body));
  if (bodyText.length < 20) return [];

  const sectionPath = titleHierarchy.join(" > ");
  if (estimateTokens(bodyText) <= MAX_CHUNK_TOKENS) {
    return [
      {
        source,
        section: sectionPath,
        content: `${sectionPath}\n\n${bodyText}`,
      },
    ];
  }
  return groupBlocks(collectTextBlocks(body), sectionPath, source);
}

function isSkippable(filename: string): boolean {
  const match = filename.match(/_NBK\d+_(.+)\.nxml$/);
  if (!match) return false;
  const part = match[1];
  return part.startsWith("fm") || part.startsWith("rl") || part.startsWith("ak");
}

function main() {
  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((f) => f.endsWith(".nxml") && !isSkippable(f));

  console.log(`Found ${files.length} .nxml files to process`);

  const allChunks: Chunk[] = [];
  let failures = 0;

  for (const file of files) {
    try {
      const chunks = parseFile(path.join(INPUT_DIR, file));
      allChunks.push(...chunks);
    } catch (err) {
      failures++;
      console.error(`Failed to parse ${file}: ${err}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allChunks, null, 2));

  const tokens = allChunks.map((c) => estimateTokens(c.content));
  const avgTokens = Math.round(
    tokens.reduce((a, b) => a + b, 0) / tokens.length,
  );

  console.log(`\nDone.`);
  console.log(`  Files processed: ${files.length - failures}`);
  console.log(`  Files skipped (failures): ${failures}`);
  console.log(`  Total chunks: ${allChunks.length}`);
  console.log(`  Avg chunk size: ~${avgTokens} tokens`);
  console.log(`  Max chunk size: ~${Math.max(...tokens)} tokens`);
  console.log(`  Min chunk size: ~${Math.min(...tokens)} tokens`);
  console.log(`  Output: ${OUTPUT_FILE}`);
}

main();
