import prompts from "../prompts";

const tryParseJSON = (str: string) => {
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return null;
};

const buildPrompt = (
  existingFindings: { category: string; value: string }[],
  prompt: string,
) => {
  if (existingFindings.length > 0) {
    const formatted = existingFindings
      .map((f) => `${f.category}: ${f.value}`)
      .join(", ");
    prompt += ` Already recorded: ${formatted}. Do not re-extract these.`;
  }

  return prompt;
};

export { tryParseJSON, buildPrompt };
