import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

const getParams = (message: string): Anthropic.MessageCreateParams => ({
  max_tokens: 1024,
  messages: [{ role: "user", content: `${message}` }],
  model: "claude-haiku-4-5-20251001",
});

export const sendMessage = async (message: string) => {
  const response = await client.messages.create(getParams(message));
  return response;
};
