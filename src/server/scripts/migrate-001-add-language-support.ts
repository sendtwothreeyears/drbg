import pool from "../db/index";

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en'
    `);

    await client.query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS original_content TEXT
    `);

    await client.query(`
      ALTER TABLE messages
      ADD COLUMN IF NOT EXISTS original_language TEXT
    `);

    await client.query("COMMIT");
    console.log("Migration 001 complete: language support columns added");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration 001 failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
