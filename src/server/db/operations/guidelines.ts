import pool from "../";
import { randomUUID } from "crypto";

const searchGuidelineChunksQuery = async (
  embedding: number[],
  limit: number = 5,
) => {
  const { rows } = await pool.query(
    `SELECT chunkid, source, section, content,
     1 - (embedding <=> $1::vector) AS similarity
     FROM guideline_chunks
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [JSON.stringify(embedding), limit],
  );
  return rows;
};

const createGuidelineChunkMutation = async (
  source: string,
  section: string | null,
  content: string,
  embedding: number[],
) => {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO guideline_chunks (chunkid, source, section, content, embedding)
     VALUES ($1, $2, $3, $4, $5::vector)`,
    [id, source, section, content, JSON.stringify(embedding)],
  );
  return id;
};

export { searchGuidelineChunksQuery, createGuidelineChunkMutation };
