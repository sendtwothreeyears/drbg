import type { OpenAITool } from "../services/openai-chat";

export const collectDemographicsTool: OpenAITool = {
  type: "function",
  function: {
    name: "collect_demographics",
    description:
      "Collect the patient's age and biological sex via an inline form. Use this when you need demographic information to provide a better clinical assessment. Do not ask for this information in conversation text.",
    parameters: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string",
          description:
            "A brief explanation of why you need this information, shown to the patient above the form.",
        },
      },
      required: ["reason"],
    },
  },
};
