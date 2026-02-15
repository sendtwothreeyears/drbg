import fs from "fs";
import path from "path";

const BASE_URL = "https://www.nice.org.uk/guidance";
const OUTPUT_DIR = path.resolve("data/nice-guidelines/raw");
const DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface GuidelineRef {
  prefix: string;
  number: number;
  ref: string;
}

function buildGuidelineList(): GuidelineRef[] {
  const refs: GuidelineRef[] = [];

  for (let i = 1; i <= 255; i++) {
    refs.push({ prefix: "ng", number: i, ref: `ng${i}` });
  }
  for (let i = 1; i <= 229; i++) {
    refs.push({ prefix: "cg", number: i, ref: `cg${i}` });
  }

  return refs;
}

async function downloadGuideline(
  guideline: GuidelineRef,
  index: number,
  total: number,
): Promise<"saved" | "skipped" | "failed"> {
  const url = `${BASE_URL}/${guideline.ref}/chapter/Recommendations`;
  const outPath = path.join(OUTPUT_DIR, `${guideline.ref}.html`);

  if (fs.existsSync(outPath)) {
    console.log(
      `[${index + 1}/${total}] ${guideline.ref} — already exists, skipping`,
    );
    return "skipped";
  }

  process.stdout.write(`[${index + 1}/${total}] ${guideline.ref}... `);

  const res = await fetch(url);

  if (res.status === 404 || res.status === 410) {
    console.log(`${res.status} (skipped)`);
    return "skipped";
  }

  if (!res.ok) {
    console.log(`HTTP ${res.status} (failed)`);
    return "failed";
  }

  const html = await res.text();
  fs.writeFileSync(outPath, html);
  console.log("OK (saved)");
  return "saved";
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const guidelines = buildGuidelineList();
  console.log(
    `Downloading NICE guidelines (${guidelines.length} candidates)...\n`,
  );

  let saved = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < guidelines.length; i++) {
    try {
      const result = await downloadGuideline(guidelines[i], i, guidelines.length);
      if (result === "saved") saved++;
      else if (result === "skipped") skipped++;
      else failed++;
    } catch (err) {
      failed++;
      console.log(`error: ${err}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone.`);
  console.log(`  Saved: ${saved}`);
  console.log(`  Skipped (404/exists): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Output: ${OUTPUT_DIR}`);
}

main();
