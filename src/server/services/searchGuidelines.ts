import OpenAI from "openai";
import { searchGuidelineChunksQuery } from "../db/operations/guidelines";
import type { Finding } from "../../types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const embedQuery = async (text: string): Promise<number[]> => {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return res.data[0].embedding;
};

const MIN_SIMILARITY = 0.50;

const searchGuidelines = async (
  condition: string,
  findings: Finding[],
  limit: number = 5,
) => {
  // Primary: search by condition alone for focused matches
  const conditionEmbedding = await embedQuery(condition);
  const conditionChunks = await searchGuidelineChunksQuery(conditionEmbedding, limit);

  // Secondary: search by condition + findings for broader context
  const findingsQuery = [
    condition,
    ...findings.map((f) => `${f.category}: ${f.value}`),
  ].join(". ");
  const findingsEmbedding = await embedQuery(findingsQuery);
  const findingsChunks = await searchGuidelineChunksQuery(findingsEmbedding, limit);

  // Dedupe by chunkid, keep highest similarity
  const seen = new Map<string, typeof conditionChunks[0]>();
  for (const chunk of [...conditionChunks, ...findingsChunks]) {
    const existing = seen.get(chunk.chunkid);
    if (!existing || chunk.similarity > existing.similarity) {
      seen.set(chunk.chunkid, chunk);
    }
  }

  // Re-rank: boost similarity for chunks containing finding keywords
  const findingTerms = findings.map((f) => f.value.toLowerCase());
  const reranked = Array.from(seen.values()).map((chunk) => {
    const lower = chunk.content.toLowerCase();
    const matches = findingTerms.filter((term) => lower.includes(term)).length;
    const boost = matches * 0.01;
    return { ...chunk, similarity: chunk.similarity + boost };
  });

  const sorted = reranked.sort((a, b) => b.similarity - a.similarity);
  console.log(`\n[searchGuidelines] condition: "${condition}"`);
  console.log(`[searchGuidelines] top scores (before filter):`, sorted.slice(0, 5).map((c) => ({ similarity: c.similarity.toFixed(4), section: c.section?.substring(0, 80) })));
  console.log(`[searchGuidelines] passed 0.85 threshold: ${sorted.filter((c) => c.similarity >= MIN_SIMILARITY).length}/${sorted.length}`);

  return sorted
    .filter((c) => c.similarity >= MIN_SIMILARITY)
    .slice(0, limit);
};

export { embedQuery, searchGuidelines };
