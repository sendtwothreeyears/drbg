import Anthropic from "@anthropic-ai/sdk";
import type { Finding } from "../../types";

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

type GuidelineChunk = {
  chunkid: string;
  source: string;
  section: string;
  content: string;
  similarity: number;
};

type AssessmentResult = {
  text: string;
  sources: { source: string; section: string; similarity: number; condition: string; confidence: string }[];
};

const generateAssessment = async (
  findings: Finding[],
  diagnoses: { condition: string; confidence: string }[],
  guidelineResults: GuidelineChunk[][],
): Promise<AssessmentResult> => {
  // Build structured context for the prompt
  const findingsText = findings
    .map((f) => `- ${f.category}: ${f.value}`)
    .join("\n");

  const diagnosesText = diagnoses
    .map((d) => `- ${d.condition} (${d.confidence} confidence)`)
    .join("\n");

  // Group guidelines by diagnosis to preserve association
  const guidelinesText = diagnoses
    .map((d, i) => {
      const chunks = guidelineResults[i] || [];
      const chunkText = chunks
        .map((c) => `[${c.source} — ${c.section}]\n${c.content}`)
        .join("\n\n");
      return `GUIDELINES FOR ${d.condition} (${d.confidence} confidence):\n${chunkText}`;
    })
    .join("\n\n---\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2048,
    system: `You are a clinical decision-support assistant. Given a patient's clinical findings, differential diagnoses, and relevant clinical guideline excerpts, generate a concise Assessment & Plan. Structure your response as:

ASSESSMENT:
A brief clinical summary linking the findings to the most likely diagnoses.

PLAN:
Numbered actionable steps covering recommended investigations, treatment, and follow-up.

Base your recommendations on the provided guideline excerpts. Do not fabricate guideline references. Keep the language clinical but accessible.`,
    messages: [
      {
        role: "user",
        content: `CLINICAL FINDINGS:\n${findingsText}\n\nDIFFERENTIAL DIAGNOSES:\n${diagnosesText}\n\nCLINICAL GUIDELINES:\n${guidelinesText}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Deduplicate sources for storage
  const seen = new Set<string>();
  const sources: AssessmentResult["sources"] = [];
  for (let i = 0; i < guidelineResults.length; i++) {
    for (const chunk of guidelineResults[i]) {
      if (!seen.has(chunk.chunkid)) {
        seen.add(chunk.chunkid);
        sources.push({
          source: chunk.source,
          section: chunk.section,
          similarity: chunk.similarity,
          condition: diagnoses[i].condition,
          confidence: diagnoses[i].confidence,
        });
      }
    }
  }

  const confidenceRank: Record<string, number> = { high: 0, moderate: 1, low: 2 };
  return {
    text,
    sources: sources.sort(
      (a, b) => confidenceRank[a.confidence] - confidenceRank[b.confidence] || b.similarity - a.similarity
    ),
  };
};

export { generateAssessment };
export type { GuidelineChunk, AssessmentResult };
