import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const FILE_LIST_URL =
  "https://ftp.ncbi.nlm.nih.gov/pub/litarch/file_list.csv";
const FTP_BASE = "https://ftp.ncbi.nlm.nih.gov/pub/litarch/";
const OUTPUT_DIR = path.resolve("data/who-guidelines");
const TEMP_DIR = path.resolve("data/who-guidelines/.tmp");
const DELAY_MS = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

interface BookEntry {
  filePath: string;
  citation: string;
}

function parseFileList(csv: string): BookEntry[] {
  const lines = csv.split("\n").filter((l) => l.trim());
  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase());

  console.log(`CSV columns: ${header.join(", ")}`);

  const fileIdx = header.findIndex((h) => h.includes("file"));
  const citationIdx = header.findIndex(
    (h) => h.includes("citation") || h.includes("article")
  );

  if (fileIdx === -1) {
    throw new Error(
      `Could not find file column in CSV header: ${header.join(", ")}`
    );
  }

  const entries: BookEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length > fileIdx) {
      entries.push({
        filePath: fields[fileIdx],
        citation: citationIdx >= 0 ? fields[citationIdx] : fields.join(" "),
      });
    }
  }
  return entries;
}

function filterWHO(entries: BookEntry[]): BookEntry[] {
  return entries.filter((e) =>
    e.citation.toLowerCase().includes("world health organization")
  );
}

function findNxmlFiles(dir: string): string[] {
  const results: string[] = [];
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) results.push(...findNxmlFiles(fullPath));
    else if (dirent.name.endsWith(".nxml")) results.push(fullPath);
  }
  return results;
}

async function downloadAndExtract(
  entry: BookEntry,
  index: number,
  total: number
): Promise<number> {
  const url = `${FTP_BASE}${entry.filePath}`;
  const basename = path.basename(entry.filePath, ".tar.gz");
  const extractDir = path.join(TEMP_DIR, basename);
  const tarPath = path.join(TEMP_DIR, path.basename(entry.filePath));

  console.log(
    `[${index + 1}/${total}] Downloading ${path.basename(entry.filePath)}...`
  );

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tarPath, buffer);

  fs.mkdirSync(extractDir, { recursive: true });
  execSync(`tar -xzf "${tarPath}" -C "${extractDir}"`, { stdio: "pipe" });

  let extracted = 0;
  for (const nxmlPath of findNxmlFiles(extractDir)) {
    fs.renameSync(nxmlPath, path.join(OUTPUT_DIR, `${basename}_${path.basename(nxmlPath)}`));
    extracted++;
  }

  fs.unlinkSync(tarPath);
  fs.rmSync(extractDir, { recursive: true, force: true });

  return extracted;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  console.log("Fetching NCBI Bookshelf file list...");
  const res = await fetch(FILE_LIST_URL);
  if (!res.ok) throw new Error(`Failed to fetch file list: HTTP ${res.status}`);
  const csv = await res.text();

  const allEntries = parseFileList(csv);
  console.log(`Total entries in file list: ${allEntries.length}`);

  const whoEntries = filterWHO(allEntries);
  console.log(`Found ${whoEntries.length} WHO guidelines\n`);

  if (whoEntries.length === 0) {
    console.log("No WHO guidelines found. Exiting.");
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    return;
  }

  let totalExtracted = 0;
  let failures = 0;

  for (let i = 0; i < whoEntries.length; i++) {
    try {
      const extracted = await downloadAndExtract(
        whoEntries[i],
        i,
        whoEntries.length
      );
      totalExtracted += extracted;
      console.log(
        `  Extracted ${extracted} .nxml files (${totalExtracted} total)`
      );
    } catch (err) {
      failures++;
      console.error(`  Failed: ${err}`);
    }

    await sleep(DELAY_MS);
  }

  fs.rmSync(TEMP_DIR, { recursive: true, force: true });

  console.log(`\nDone. ${totalExtracted} .nxml files saved to ${OUTPUT_DIR}`);
  if (failures > 0) console.log(`${failures} downloads failed.`);
}

main();
