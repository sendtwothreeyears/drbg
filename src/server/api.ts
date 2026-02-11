import Anthropic from "@anthropic-ai/sdk";
import prompts from "./prompts";

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

const getParams = (messages: Anthropic.MessageParam[], promptKey = "clinical-interview"): Anthropic.MessageCreateParams => ({
  max_tokens: 1024,
  system: prompts[promptKey],
  messages,
  model: "claude-haiku-4-5-20251001",
});

export const streamMessage = (messages: Anthropic.MessageParam[], promptKey: string) => {
  return client.messages.stream(getParams(messages, promptKey));
};
