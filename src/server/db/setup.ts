import Database from "better-sqlite3";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync, unlinkSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "bogan.db");
const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
const reset = process.argv.includes("--reset");

if (reset && existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
  console.log("Deleted the database");
}

const db = new Database(DB_PATH);
db?.exec(schema);
