import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const INPUT_DIR = path.resolve("data/nice-guidelines/raw");
const OUTPUT_FILE = path.resolve("data/nice-guidelines/chunks.json");
const MAX_CHUNK_TOKENS = 400;
const OVERLAP_TOKENS = 100;

interface Chunk {
  source: string;
  section: string;
  content: string;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
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

function groupBlocks(
  blocks: string[],
  sectionPath: string,
  source: string,
): Chunk[] {
  if (blocks.length === 0) return [];
  const chunks: Chunk[] = [];
  let current: string[] = [];
  let currentTokens = estimateTokens(sectionPath) + 2;

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
        const overlap = overlapWords.join(" ");
        current = overlap ? [overlap] : [];
        currentTokens =
          estimateTokens(sectionPath) + 2 + estimateTokens(overlap);
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

// Heading levels: h1=1, h2=2, ..., h6=6
function headingLevel(tagName: string): number | null {
  const match = tagName.match(/^h([1-6])$/i);
  return match ? parseInt(match[1]) : null;
}

interface Section {
  title: string;
  level: number;
  blocks: string[];
}

function parseFile(filePath: string): Chunk[] {
  const html = fs.readFileSync(filePath, "utf-8");
  const $ = cheerio.load(html);
  const source = path.basename(filePath, ".html");

  // Extract guideline title from h1
  const guidelineTitle = cleanText($("h1").first().text());
  if (!guidelineTitle) return [];

  // Collect all headings and content blocks in document order
  // We target the main content area — NICE wraps recommendations in the page body
  const sections: Section[] = [];
  const headingStack: string[] = [guidelineTitle]; // level 1 = guideline title
  let currentBlocks: string[] = [];
  let currentLevel = 1;

  // Walk through all elements that are headings or content
  $("h2, h3, h4, h5, h6, p, ul, ol, table").each((_, el) => {
    const $el = $(el);
    const tag = el.tagName.toLowerCase();
    const level = headingLevel(tag);

    if (level) {
      // It's a heading — flush accumulated content for previous section
      if (currentBlocks.length > 0) {
        const sectionPath = headingStack.slice(0, currentLevel).join(" > ");
        sections.push({
          title: sectionPath,
          level: currentLevel,
          blocks: [...currentBlocks],
        });
        currentBlocks = [];
      }

      const headingText = cleanText($el.text());
      if (!headingText) return;

      // Update heading stack at this level, clear deeper levels
      headingStack[level - 1] = headingText;
      headingStack.length = level;
      currentLevel = level;
    } else {
      // It's content — extract text
      let text = "";
      if (tag === "table") {
        // Extract table rows as text
        $el.find("tr").each((_, row) => {
          const cells: string[] = [];
          $(row)
            .find("td, th")
            .each((_, cell) => {
              cells.push(cleanText($(cell).text()));
            });
          if (cells.length > 0) {
            text += cells.join(" | ") + "\n";
          }
        });
        text = text.trim();
      } else if (tag === "ul" || tag === "ol") {
        const items: string[] = [];
        $el.children("li").each((_, li) => {
          items.push("- " + cleanText($(li).text()));
        });
        text = items.join("\n");
      } else {
        text = cleanText($el.text());
      }

      if (text && text.length > 5) {
        currentBlocks.push(text);
      }
    }
  });

  // Flush final section
  if (currentBlocks.length > 0) {
    const sectionPath = headingStack.slice(0, currentLevel).join(" > ");
    sections.push({
      title: sectionPath,
      level: currentLevel,
      blocks: [...currentBlocks],
    });
  }

  // Convert sections to chunks
  const allChunks: Chunk[] = [];
  for (const section of sections) {
    if (section.blocks.length === 0) continue;

    const fullText = section.blocks.join(" ");
    if (fullText.length < 20) continue;

    // If section fits in one chunk, keep it together
    if (estimateTokens(section.title + "\n\n" + fullText) <= MAX_CHUNK_TOKENS) {
      allChunks.push({
        source,
        section: section.title,
        content: `${section.title}\n\n${section.blocks.join("\n\n")}`,
      });
    } else {
      // Split into multiple chunks with overlap
      allChunks.push(...groupBlocks(section.blocks, section.title, source));
    }
  }

  return allChunks;
}

function main() {
  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((f) => f.endsWith(".html"));

  console.log(`Found ${files.length} HTML files to process`);

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

  if (allChunks.length === 0) {
    console.log("No chunks generated. Check that HTML files exist in raw/.");
    return;
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
