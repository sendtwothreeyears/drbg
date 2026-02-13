import { createToolRequest } from "../anthropic";
import { recordClinicalFindingTool } from "../anthropicTools/record_clinical_finding";
import {
  createFindings,
  getFindingsByConversation,
} from "../db/queries/findings";
import { buildPrompt } from "../utils";
import prompts from "../prompts";

// Called after every user message - extract relevant clinical insights
// this tool is MANUALLY called
export async function extractFindings(
  conversationId: string,
  userMessage: string,
) {
  try {
    // fetch the current findings store
    const existingFindings = await getFindingsByConversation(conversationId);
    // Take the existing findings, the clinical prompt for findings, format the findings for use in the new prompt to send to Anthropic
    const newPrompt = buildPrompt(
      existingFindings,
      prompts["CLINICAL_EXTRACTION"],
    );

    // pass in a custom tool (clinicalExtraction) to Anthropic, and return the result
    const response = await createToolRequest(
      newPrompt,
      userMessage,
      recordClinicalFindingTool,
    );

    const toolBlock = response.content.find(
      (block) => block.type === "tool_use",
    );
    // Model: toolBlock {
    //   type: 'tool_use',
    //   id: 'toolu_01D9s77jbyHF5Xvoxu4YcAUb',
    //   name: 'record_clinical_finding',
    //   input: { findings: [ [Object] ] }
    // }
    if (toolBlock && toolBlock.type === "tool_use") {
      const { findings } = toolBlock.input as {
        findings: {
          category: string;
          value: string;
        }[];
      };

      if (findings?.length > 0) {
        await createFindings(conversationId, findings);
      }
    }
  } catch (err) {
    console.error("Finding extraction failed:", err);
  }
}
