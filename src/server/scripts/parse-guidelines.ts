import fs from "fs";
import path from "path";

const INPUT_DIR = path.resolve("data/guidelines");
const OUTPUT_FILE = path.resolve("data/chunks.json");

type Chunk = {
  pmcId: string;
  title: string;
  section: string;
  text: string;
};

function stripTags(xml: string): string {
  return xml.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function getElementText(el: string): string {
  return stripTags(el);
}

function extractBetween(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function extractAll(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  return xml.match(regex) || [];
}

function extractAttr(xml: string, tag: string, attr: string, attrVal: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*${attr}="${attrVal}"[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? stripTags(match[1]) : null;
}

function extractTitle(xml: string): string {
  const titleGroup = extractBetween(xml, "title-group");
  if (!titleGroup) return "Untitled";
  const articleTitle = extractBetween(titleGroup, "article-title");
  return articleTitle ? stripTags(articleTitle) : "Untitled";
}

function extractPmcId(xml: string): string {
  return extractAttr(xml, "article-id", "pub-id-type", "pmcid") || "unknown";
}

function extractSectionText(secXml: string): string {
  // Get paragraphs directly in this section (not nested subsections)
  const paragraphs: string[] = [];

  // Remove nested <sec> elements to avoid double-counting
  const withoutSubsections = secXml.replace(/<sec[\s>][\s\S]*?<\/sec>/gi, "");

  const pMatches = extractAll(withoutSubsections, "p");
  for (const p of pMatches) {
    const text = stripTags(p);
    if (text) paragraphs.push(text);
  }

  return paragraphs.join("\n\n");
}

function extractSectionTitle(secXml: string): string {
  // Get the first <title> directly in this section
  const match = secXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]) : "";
}

function parseSections(bodyXml: string): { section: string; text: string }[] {
  const results: { section: string; text: string }[] = [];

  // Match top-level sections
  const sectionRegex = /<sec[\s>][\s\S]*?<\/sec>/gi;
  let match;

  // We need to handle nesting — only grab top-level <sec> elements
  // Simple approach: split body by top-level sections
  const topSections: string[] = [];
  let depth = 0;
  let current = "";
  let inSec = false;

  const tokens = bodyXml.split(/(<\/?sec[^>]*>)/gi);
  for (const token of tokens) {
    if (token.match(/^<sec[\s>]/i)) {
      if (depth === 0) {
        inSec = true;
        current = token;
      } else {
        current += token;
      }
      depth++;
    } else if (token.match(/^<\/sec>/i)) {
      depth--;
      current += token;
      if (depth === 0 && inSec) {
        topSections.push(current);
        current = "";
        inSec = false;
      }
    } else if (inSec) {
      current += token;
    }
  }

  for (const sec of topSections) {
    const sectionTitle = extractSectionTitle(sec);

    // Skip non-content sections
    const skip = ["conflicts of interest", "acknowledgment", "acknowledgement", "references", "funding", "author contributions"];
    if (skip.some((s) => sectionTitle.toLowerCase().includes(s))) continue;

    // Get text from this section and all its subsections flattened
    const allText = stripTags(sec.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "").replace(/<label[^>]*>[\s\S]*?<\/label>/gi, ""));

    if (allText.length > 50) {
      results.push({ section: sectionTitle || "Body", text: allText });
    }
  }

  return results;
}

function parseArticle(xml: string): Chunk[] {
  const chunks: Chunk[] = [];
  const title = extractTitle(xml);
  const pmcId = extractPmcId(xml);

  // Abstract
  const abstract = extractBetween(xml, "abstract");
  if (abstract) {
    const abstractText = stripTags(abstract);
    if (abstractText.length > 50) {
      chunks.push({ pmcId, title, section: "Abstract", text: abstractText });
    }
  }

  // Body sections
  const body = extractBetween(xml, "body");
  if (body) {
    const sections = parseSections(body);
    for (const sec of sections) {
      chunks.push({ pmcId, title, section: sec.section, text: sec.text });
    }
  }

  return chunks;
}

function main() {
  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith(".xml"));
  console.log(`Parsing ${files.length} XML files...`);

  const allChunks: Chunk[] = [];
  let skipped = 0;

  for (const file of files) {
    try {
      const xml = fs.readFileSync(path.join(INPUT_DIR, file), "utf-8");
      const chunks = parseArticle(xml);
      if (chunks.length > 0) {
        allChunks.push(...chunks);
      } else {
        skipped++;
      }
    } catch (err) {
      skipped++;
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allChunks, null, 2));
  console.log(`Done. ${allChunks.length} chunks from ${files.length - skipped} articles.`);
  console.log(`Skipped ${skipped} files (no extractable content).`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main();
