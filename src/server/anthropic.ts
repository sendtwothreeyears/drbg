import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

export const createChatStream = (
  messages: Anthropic.MessageParam[],
  system: string,
  tools?: Anthropic.Tool[],
) => {
  return client.messages.stream({
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
) => {
  return client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: newPrompt,
    messages: [{ role: "user", content: userMessage }],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
  });
};
