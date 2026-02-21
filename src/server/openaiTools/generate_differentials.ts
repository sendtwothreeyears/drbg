import type { OpenAITool } from "../services/openai-chat";

export const generateDifferentialsTool: OpenAITool = {
  type: "function",
  function: {
    name: "generate_differentials",
    description:
      "Analyze the patient's accumulated clinical findings and generate a ranked list of differential diagnoses. Consider all findings including symptoms, duration, severity, location, onset, medical history, medications, and allergies. Rank diagnoses by likelihood given the clinical picture.",
    parameters: {
      type: "object" as const,
      properties: {
        differentials: {
          type: "array",
          items: {
            type: "object",
            properties: {
              condition: {
                type: "string",
                description: "The name of the suspected condition or diagnosis",
              },
              confidence: {
                type: "string",
                enum: ["high", "moderate", "low"],
                description: "Likelihood of this diagnosis given the findings",
              },
            },
            required: ["condition", "confidence"],
          },
          description: "Array of differential diagnoses ranked by likelihood",
        },
      },
      required: ["differentials"],
    },
  },
};
