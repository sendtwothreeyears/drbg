import { createToolMessage } from "../anthropic";
import { recordClinicalFindingTool } from "../tools/record_clinical_finding";
import { createFindings, getFindingsByConversation } from "../db/queries/findings";
import prompts from "../prompts";

const buildPrompt = (existingFindings: { category: string; value: string }[]) => {
  let prompt = prompts["CLINICAL_EXTRACTION"];

  if (existingFindings.length > 0) {
    const formatted = existingFindings.map((f) => `${f.category}: ${f.value}`).join(", ");
    prompt += ` Already recorded: ${formatted}. Do not re-extract these.`;
  }

  return prompt;
};

export async function extractFindings(conversationId: string, userMessage: string) {
  try {
    const existing = getFindingsByConversation(conversationId);
    const system = buildPrompt(existing);

    const response = await createToolMessage(system, userMessage, recordClinicalFindingTool);

    const toolBlock = response.content.find((block) => block.type === "tool_use");
    if (toolBlock && toolBlock.type === "tool_use") {
      const { findings } = toolBlock.input as { findings: { category: string; value: string }[] };
      if (findings?.length > 0) {
        createFindings(conversationId, findings);
      }
    }
  } catch (err) {
    console.error("Finding extraction failed:", err);
  }
}
