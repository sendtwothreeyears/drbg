import OpenAI from "openai";
import { searchGuidelineChunksQuery } from "../db/operations/guidelines";
import type { Finding } from "../../types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const embedQuery = async (text: string): Promise<number[]> => {
  const res = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  return res.data[0].embedding;
};

const MIN_SIMILARITY = 0.85;

const searchGuidelines = async (
  condition: string,
  findings: Finding[],
  limit: number = 5,
) => {
  const query = [
    condition,
    ...findings.map((f) => `${f.category}: ${f.value}`),
  ].join(". ");

  const embedding = await embedQuery(query);
  const chunks = await searchGuidelineChunksQuery(embedding, limit);
  return chunks.filter((c) => c.similarity >= MIN_SIMILARITY);
};

export { embedQuery, searchGuidelines };
