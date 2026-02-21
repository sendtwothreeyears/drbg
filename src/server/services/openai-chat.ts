import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenAITool = OpenAI.ChatCompletionTool;

export function createOpenAIChatStream(
  messages: OpenAIMessage[],
  system: string,
  tools?: OpenAITool[],
  model: string = "gpt-5.2",
) {
  return client.chat.completions.create({
    model,
    messages: [{ role: "system", content: system }, ...messages],
    stream: true,
    ...(tools && tools.length > 0 ? { tools } : {}),
    max_tokens: 1024,
  });
}
