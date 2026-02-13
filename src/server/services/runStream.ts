import { getMessagesByConversationQuery } from "../db/operations/messages";
import { createMessageMutation } from "../db/operations/messages";
import { ToolCall, Message, ContentBlock } from "../../types";
import { tryParseJSON } from "../utils";
import { extractFindings } from "./extractFindings";
import tools from "../anthropicTools";
import CLINICAL_INTERVIEW from "../prompts/CLINICAL_INTERVIEW";
import { createChatStream } from "./anthropic";

const systemPrompt = CLINICAL_INTERVIEW;

// initiates stream, provides functions to use DURING stream
export async function runStream(
  conversationId: string,
  onText: (text: string) => void,
  onToolUse: (tool: ToolCall) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  toolName?: string,
) {
  // Fetches the messages ONCE before the stream starts
  const dbMessages: Message[] =
    await getMessagesByConversationQuery(conversationId);

  // Maps the messages to be Anthropic API Friendly
  const messages = dbMessages
    .map((m) => ({
      role: m.role as "user" | "assistant",
      // If we have an array of messages, it's prompting the client-side tool
      content: tryParseJSON(m.content) || m.content,
    }))
    .filter((_, i, arr) => !(i === 0 && arr[0].role === "assistant"));

  // Selects the tool, if we have specified one
  const tool = toolName ? tools[toolName] : undefined;

  // Initialize Anthropic Streaming, with or without tool
  const stream = createChatStream(
    messages,
    systemPrompt,
    tool ? [tool] : undefined,
  );

  // defined ONCE before streaming
  let fullText = "";
  const toolCalls: ToolCall[] = [];

  // ------

  // Start Streaming, gradually appending text to fullText, sending back to
  // client in chunks
  stream.on("text", (text) => {
    fullText += text;
    onText(text);
  });

  // If Claude specifies we need to use a tool, pass it back to the user
  // This allows the client to show a pending tool (e.g. Demographics)
  stream.on("contentBlock", (block) => {
    if (block.type === "tool_use") {
      toolCalls.push({ id: block.id, name: block.name, input: block.input });
    }
  });

  // Stream Error Handling
  stream.on("error", (err) => {
    onError(err);
  });

  // Stream Completion
  stream.on("end", async () => {
    // Stream completion after a tool has been selected.
    // these are for tools that were PASSED IN.
    if (toolCalls.length > 0) {
      const contentBlocks: ContentBlock[] = [];
      if (fullText) {
        contentBlocks.push({ type: "text", text: fullText });
      }
      // When we have tools that need to be used, we send them back to the client
      for (const tool of toolCalls) {
        contentBlocks.push({
          type: "tool_use",
          id: tool.id,
          name: tool.name,
          input: tool.input,
        });
      }
      // When stream is done, persist the FINAL Agent message into our database
      await createMessageMutation(
        conversationId,
        "assistant",
        JSON.stringify(contentBlocks),
      );

      // Notify client of each tool call (which was passed in route setup)
      for (const tool of toolCalls) {
        onToolUse(tool);
      }
    }
    // If we have NO tool active
    else {
      await createMessageMutation(conversationId, "assistant", fullText);
    }

    // Extract clinical findings before signaling done
    const lastUserMsg = dbMessages.findLast((m: Message) => m.role === "user");
    if (lastUserMsg) {
      // Manually call this tool after the last user message to extract clinical findings
      await extractFindings(conversationId, lastUserMsg.content);
    }
    // send the message back to the user
    // -- this writes the final data within the res response back to client
    onDone();
  });
}
