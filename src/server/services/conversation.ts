import { streamMessage } from "../anthropic";
import { getMessagesByConversation, createMessage } from "../db/queries/messages";
import { collectDemographicsTool } from "../tools/demographics";
import CLINICAL_INTERVIEW from "../prompts/CLINICAL_INTERVIEW";

const tryParseJSON = (str: string) => {
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return null;
};

type ToolUseBlock = { id: string; name: string; input: any };

export async function runStream(
  conversationId: string,
  onText: (text: string) => void,
  onToolUse: (tool: ToolUseBlock) => void,
  onDone: () => void,
  onError: (err: Error) => void,
) {
  // Load messages from DB and format for Anthropic
  const dbMessages: any[] = getMessagesByConversation(conversationId);
  const messages = dbMessages
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: tryParseJSON(m.content) || m.content,
    }))
    .filter((_, i, arr) => !(i === 0 && arr[0].role === "assistant"));

  const systemPrompt = CLINICAL_INTERVIEW;

  // Stream from Claude
  const stream = streamMessage(messages, systemPrompt, [collectDemographicsTool]);
  let fullText = "";
  const toolUseBlocks: ToolUseBlock[] = [];

  stream.on("text", (text) => {
    fullText += text;
    onText(text);
  });

  stream.on("contentBlock", (block) => {
    if (block.type === "tool_use") {
      toolUseBlocks.push({ id: block.id, name: block.name, input: block.input });
    }
  });

  stream.on("error", (err) => {
    onError(err);
  });

  stream.on("end", () => {
    // Save assistant message
    if (toolUseBlocks.length > 0) {
      const contentBlocks: any[] = [];
      if (fullText) {
        contentBlocks.push({ type: "text", text: fullText });
      }
      for (const block of toolUseBlocks) {
        contentBlocks.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
      createMessage(conversationId, "assistant", JSON.stringify(contentBlocks));

      // Notify client of each tool call
      for (const block of toolUseBlocks) {
        onToolUse(block);
      }
    } else {
      createMessage(conversationId, "assistant", fullText);
    }

    onDone();
  });
}
