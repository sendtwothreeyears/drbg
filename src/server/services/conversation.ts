import { streamMessage } from "../anthropic";
import { getMessagesByConversation, createMessage } from "../db/queries/messages";
import { buildClinicalInterviewPrompt } from "../prompts/CLINICAL_INTERVIEW";

const tryParseJSON = (str: string) => {
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return null;
};

export async function runStream(
  conversationId: string,
  onText: (text: string) => void,
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

  const systemPrompt = buildClinicalInterviewPrompt();

  // Stream from Claude
  const stream = streamMessage(messages, systemPrompt);
  let fullText = "";

  stream.on("text", (text) => {
    fullText += text;
    onText(text);
  });

  stream.on("error", (err) => {
    onError(err);
  });

  stream.on("end", () => {
    createMessage(conversationId, "assistant", fullText);
    onDone();
  });
}
