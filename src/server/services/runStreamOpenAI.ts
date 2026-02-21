import { getMessagesByConversationQuery } from "../db/operations/messages";
import { createMessageMutation } from "../db/operations/messages";
import { getConversationQuery } from "../db/operations/conversations";
import { ToolCall, Message, ContentBlock } from "../../types";
import { extractFindings } from "./extractFindings";
import { createOpenAIChatStream, OpenAIMessage } from "./openai-chat";
import openaiTools from "../openaiTools";
import CLINICAL_INTERVIEW from "../prompts/CLINICAL_INTERVIEW";
import { translateText } from "./translate";
import { createDiagnosesMutation } from "../db/operations/diagnoses";
import { markConversationCompletedMutation, updateAssessmentMutation } from "../db/operations/conversations";
import { searchGuidelines } from "./searchGuidelines";
import { generateAssessment } from "./generateAssessment";
import { getFindingsByConversationQuery } from "../db/operations/findings";
import { randomUUID } from "crypto";

function getSystemPrompt(language: string): string {
  const languageInstruction = language === "ak"
    ? "\n\nIMPORTANT: Conduct this entire clinical interview in Twi (Akan). The patient speaks Twi. Respond in Twi. If the patient uses English medical terms (e.g., 'malaria', 'paracetamol'), acknowledge them naturally — this is normal code-switching."
    : "";

  return CLINICAL_INTERVIEW + languageInstruction;
}

// OpenAI-native streaming — parallel to runStream (Anthropic) with same callback interface
export async function runStreamOpenAI(
  conversationId: string,
  onText: (text: string) => void,
  onToolUse: (tool: ToolCall) => void,
  onAssessmentLoading: () => void,
  onDone: (meta?: Record<string, any>) => void,
  onError: (err: Error) => void,
  toolName?: string,
) {
  // Fetch conversation to get language
  const conversation = await getConversationQuery(conversationId);
  const language = conversation?.language || "en";

  // Fetch messages ONCE before the stream starts
  const dbMessages: Message[] = await getMessagesByConversationQuery(conversationId);

  // Map messages to OpenAI format
  // For Twi conversations, send original_content (Twi) so OpenAI sees the patient's language
  // For English conversations, send content as-is
  const messages: OpenAIMessage[] = dbMessages
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: (language !== "en" && m.original_content)
        ? m.original_content
        : m.content,
    }))
    .filter((_, i, arr) => !(i === 0 && arr[0].role === "assistant"));

  // Get language-aware system prompt + select tool if specified
  const systemPrompt = getSystemPrompt(language);
  const tool = toolName ? openaiTools[toolName] : undefined;

  try {
    // Initialize OpenAI streaming
    const stream = await createOpenAIChatStream(
      messages,
      systemPrompt,
      tool ? [tool] : undefined,
    );

    // Defined ONCE before streaming
    let fullText = "";
    const functionCalls: { name: string; arguments: string }[] = [];

    // Stream from OpenAI — for await loop (vs Anthropic's event emitter)
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      // Text chunks — send to client immediately
      if (delta?.content) {
        fullText += delta.content;
        onText(delta.content);
      }

      // Tool calls — OpenAI streams function arguments incrementally
      // Must accumulate full JSON before parsing
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!functionCalls[idx]) {
            functionCalls[idx] = { name: "", arguments: "" };
          }
          if (tc.function?.name) functionCalls[idx].name = tc.function.name;
          if (tc.function?.arguments) functionCalls[idx].arguments += tc.function.arguments;
        }
      }
    }

    // --- Stream complete ---

    // Translate assistant response for bilingual storage
    let englishContent = fullText;
    let originalContent: string | null = null;
    let originalLanguage: string | null = null;

    if (language !== "en" && fullText) {
      originalContent = fullText;
      originalLanguage = language;
      englishContent = await translateText(fullText, language, "en");
    }

    // Parse accumulated function calls into ToolCall format
    const toolCalls: ToolCall[] = [];
    let differentialsCall: ToolCall | null = null;

    for (const fc of functionCalls) {
      if (!fc?.name) continue;
      const input = JSON.parse(fc.arguments);
      const call: ToolCall = { id: randomUUID(), name: fc.name, input };

      if (fc.name === "generate_differentials") {
        differentialsCall = call;
      } else {
        toolCalls.push(call);
      }
    }

    // Persist assistant message
    if (toolCalls.length > 0) {
      // Tool calls present — store as content blocks (same shape as Anthropic version)
      const contentBlocks: ContentBlock[] = [];
      if (fullText) {
        contentBlocks.push({ type: "text", text: fullText });
      }
      for (const tc of toolCalls) {
        contentBlocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.input,
        });
      }
      await createMessageMutation(
        conversationId,
        "assistant",
        JSON.stringify(contentBlocks),
      );

      // Notify client of each tool call
      for (const tc of toolCalls) {
        onToolUse(tc);
      }
    } else {
      // No tool calls — store text with bilingual fields
      await createMessageMutation(
        conversationId,
        "assistant",
        englishContent,
        originalContent,
        originalLanguage,
      );
    }

    // Build metadata for the done event
    const meta: Record<string, any> = {};

    // Handle differential diagnoses — persist and kick off RAG search
    if (differentialsCall) {
      const { differentials } = differentialsCall.input as {
        differentials: { condition: string; confidence: string }[];
      };
      await createDiagnosesMutation(conversationId, differentials);
      await markConversationCompletedMutation(conversationId);

      onAssessmentLoading();

      const findings = await getFindingsByConversationQuery(conversationId);
      const guidelineResults = await Promise.all(
        differentials.map((d) => searchGuidelines(d.condition, findings)),
      );

      const { text, sources } = await generateAssessment(findings, differentials, guidelineResults);
      await updateAssessmentMutation(conversationId, text, sources);

      meta.diagnoses = true;
      meta.assessment = text;
    }

    // Extract clinical findings before signaling done (always uses English content)
    const lastUserMsg = dbMessages.findLast((m: Message) => m.role === "user");
    if (lastUserMsg) {
      await extractFindings(conversationId, lastUserMsg.content);
    }

    // Signal stream completion
    onDone(meta);
  } catch (error) {
    onError(error as Error);
  }
}
