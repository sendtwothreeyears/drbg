import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

export const streamMessage = (
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
