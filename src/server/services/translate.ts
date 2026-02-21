import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ALLOWED_LANGUAGES = ["en", "ak"] as const;
type LanguageCode = (typeof ALLOWED_LANGUAGES)[number];

const MAX_INPUT_LENGTH = 2000;
const MAX_OUTPUT_RATIO = 3;

const SYSTEM_PROMPT = `You are translating patient symptom descriptions from Twi to English for a clinical intake system. Translate accurately, preserving medical meaning. Patients may mix Twi and English — translate the Twi portions and preserve the English portions. Return only the English translation, nothing else.`;

export async function translateText(
  text: string,
  from: string,
  to: string,
): Promise<string> {
  if (from === "en") return text;
  if (!text.trim()) return text;

  if (
    !ALLOWED_LANGUAGES.includes(from as LanguageCode) ||
    !ALLOWED_LANGUAGES.includes(to as LanguageCode)
  ) {
    throw new Error(`Unsupported language pair: ${from} → ${to}`);
  }

  if (text.length > MAX_INPUT_LENGTH) {
    throw new Error(`Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`);
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    temperature: 0,
    max_tokens: 1024,
  });

  const translated = response.choices[0]?.message?.content?.trim();

  if (!translated) {
    throw new Error("Translation returned empty response");
  }

  if (translated.length > text.length * MAX_OUTPUT_RATIO) {
    throw new Error("Translation output suspiciously longer than input");
  }

  return translated;
}
