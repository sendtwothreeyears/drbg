import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ak: "Twi (Akan)",
  // Future languages:
  // ee: "Ewe",
  // ga: "Ga",
};

const MAX_INPUT_LENGTH = 2000;
const MAX_OUTPUT_RATIO = 3;

function getTranslationPrompt(from: string, to: string): string {
  const fromName = LANGUAGE_NAMES[from] || from;
  const toName = LANGUAGE_NAMES[to] || to;

  if (to === "en") {
    return `You are translating patient symptom descriptions from ${fromName} to English for a clinical intake system. Translate accurately, preserving medical meaning. Patients may mix ${fromName} and English — translate the ${fromName} portions and preserve the English portions. Return only the English translation, nothing else.`;
  }

  return `You are translating clinical interview text from English to ${toName} for a patient-facing medical application. Translate accurately, preserving medical meaning. Use natural ${toName} that a patient would understand. For medical terms with no common ${toName} equivalent, keep the English term. Return only the ${toName} translation, nothing else.`;
}

export async function translateText(
  text: string,
  from: string,
  to: string,
): Promise<string> {
  if (from === to) return text;
  if (!text.trim()) return text;

  if (!LANGUAGE_NAMES[from] || !LANGUAGE_NAMES[to]) {
    throw new Error(`Unsupported language pair: ${from} → ${to}`);
  }

  if (text.length > MAX_INPUT_LENGTH) {
    throw new Error(`Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`);
  }

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: getTranslationPrompt(from, to) },
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
