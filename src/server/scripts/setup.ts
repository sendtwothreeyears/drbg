import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import pool from "../db";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(__dirname, "../db/schema/schema.sql"), "utf-8");
const reset = process.argv.includes("--reset");

async function setup() {
  if (reset) {
    await pool.query(
      "DROP TABLE IF EXISTS clinical_findings, user_profiles, messages, conversations, users, guideline_chunks, differential_diagnoses CASCADE",
    );
    console.log("Database reset");
  }

  await pool.query(schema);
  console.log("Schema applied");
  await pool.end();
}

await setup();
