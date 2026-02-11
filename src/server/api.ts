import Anthropic from "@anthropic-ai/sdk";
import prompts from "./prompts";

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});

type StreamOptions = {
  messages: Anthropic.MessageParam[];
  system: string;
  tools?: Anthropic.Tool[];
};

export const streamMessage = ({ messages, system, tools }: StreamOptions) => {
  const params: Anthropic.MessageCreateParams = {
    max_tokens: 1024,
    system,
    messages,
    model: "claude-haiku-4-5-20251001",
    ...(tools && tools.length > 0 ? { tools } : {}),
  };
  return client.messages.stream(params);
};

export const generateTitle = async (userMessage: string): Promise<string> => {
  try {
    const response = await client.messages.create({
      max_tokens: 30,
      system: prompts["TITLE_GENERATION"],
      messages: [{ role: "user", content: userMessage }],
      model: "claude-haiku-4-5-20251001",
    });
    const block = response.content[0];
    const text = block.type === "text" ? block.text.trim() : "";
    return text || "Untitled conversation";
  } catch {
    return "Untitled conversation";
  }
};
