import Anthropic from "@anthropic-ai/sdk";
import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";
import type { APIPromise } from "@anthropic-ai/sdk/core/api-promise";
import type { Message } from "@anthropic-ai/sdk/resources/messages/messages";
import { anthropic } from "./clients";

export const createChatStream = (
  messages: Anthropic.MessageParam[],
  system: string,
  tools?: Anthropic.Tool[],
): MessageStream => {
  return anthropic.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system,
    messages,
    ...(tools && tools.length > 0 ? { tools } : {}),
  });
};

export const createToolRequest = (
  newPrompt: string,
  userMessage: string,
  tool: Anthropic.Tool,
): APIPromise<Message> => {
  return anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: newPrompt,
    messages: [{ role: "user", content: userMessage }],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
  });
};
