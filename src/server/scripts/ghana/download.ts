import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.resolve("data/ghana-stgs/raw");

const DOCUMENTS = [
  {
    name: "Ghana STG 7th Edition (2017)",
    url: "https://www.moh.gov.gh/wp-content/uploads/2020/07/GHANA-STG-2017-1.pdf",
    filename: "GHANA-STG-2017-1.pdf",
  },
  {
    name: "Ghana Essential Medicines List (2017)",
    url: "https://www.moh.gov.gh/wp-content/uploads/2020/07/GHANA-EML-2017.pdf",
    filename: "GHANA-EML-2017.pdf",
  },
];

async function downloadDocument(
  doc: (typeof DOCUMENTS)[number],
  index: number,
): Promise<"saved" | "skipped" | "failed"> {
  const outPath = path.join(OUTPUT_DIR, doc.filename);

  if (fs.existsSync(outPath)) {
    console.log(`[${index + 1}/${DOCUMENTS.length}] ${doc.name} — already exists, skipping`);
    return "skipped";
  }

  process.stdout.write(`[${index + 1}/${DOCUMENTS.length}] ${doc.name}... `);

  const res = await fetch(doc.url);

  if (!res.ok) {
    console.log(`HTTP ${res.status} (failed)`);
    return "failed";
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buffer);
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);
  console.log(`OK (${sizeMB} MB)`);
  return "saved";
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Downloading Ghana STG documents (${DOCUMENTS.length} files)...\n`);

  let saved = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < DOCUMENTS.length; i++) {
    try {
      const result = await downloadDocument(DOCUMENTS[i], i);
      if (result === "saved") saved++;
      else if (result === "skipped") skipped++;
      else failed++;
    } catch (err) {
      failed++;
      console.log(`error: ${err}`);
    }
  }

  console.log(`\nDone.`);
  console.log(`  Saved: ${saved}`);
  console.log(`  Skipped (exists): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Output: ${OUTPUT_DIR}`);
}

main();
