import "dotenv/config";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import pool from "../../db";
import { createGuidelineChunkMutation } from "../../db/operations/guidelines";

const INPUT_FILE = path.resolve("data/nice-guidelines/chunks.json");
const BATCH_SIZE = 100;
const DELAY_MS = 3500;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Chunk {
  source: string;
  section: string;
  content: string;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}

async function main() {
  const chunks: Chunk[] = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
  console.log(`Loaded ${chunks.length} NICE chunks from ${INPUT_FILE}`);

  const force = process.argv.includes("--force");

  // Check how many NICE chunks already exist (don't count WHO chunks)
  const { rows } = await pool.query(
    "SELECT COUNT(*) FROM guideline_chunks WHERE source LIKE 'ng%' OR source LIKE 'cg%'",
  );
  const existingCount = parseInt(rows[0].count, 10);

  if (existingCount > 0 && !force) {
    console.log(
      `guideline_chunks already has ${existingCount} NICE rows — skipping. Use --force to re-embed.`,
    );
    await pool.end();
    return;
  }

  if (existingCount > 0) {
    await pool.query(
      "DELETE FROM guideline_chunks WHERE source LIKE 'ng%' OR source LIKE 'cg%'",
    );
    console.log(`Removed ${existingCount} existing NICE chunks\n`);
  }

  let inserted = 0;
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const embeddings = await embedBatch(batch.map((c) => c.content));

    for (let j = 0; j < batch.length; j++) {
      await createGuidelineChunkMutation(
        batch[j].source,
        batch[j].section,
        batch[j].content,
        embeddings[j],
      );
    }

    inserted += batch.length;
    console.log(
      `[${batchNum}/${totalBatches}] Embedded and inserted ${batch.length} chunks (${inserted}/${chunks.length} total)`,
    );

    if (i + BATCH_SIZE < chunks.length) await sleep(DELAY_MS);
  }

  await pool.end();
  console.log(`\nDone. ${inserted} NICE chunks embedded and inserted.`);
}

main();
