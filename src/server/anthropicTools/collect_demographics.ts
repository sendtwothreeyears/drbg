import Anthropic from "@anthropic-ai/sdk";

export const collectDemographicsTool: Anthropic.Tool = {
  name: "collect_demographics",
  description:
    "Collect the patient's age and biological sex via an inline form. Use this when you need demographic information to provide a better clinical assessment. Do not ask for this information in conversation text.",
  input_schema: {
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
};
