import Anthropic from "@anthropic-ai/sdk";

export const recordClinicalFindingTool: Anthropic.Tool = {
  name: "record_clinical_finding",
  description:
    "Silently record structured clinical findings extracted from the patient's messages. Call this whenever you identify clinical information such as symptoms, severity, duration, location, onset, character, aggravating/relieving factors, associated symptoms, medical history, medications, or allergies. The patient will not see this tool call.",
  input_schema: {
    type: "object" as const,
    properties: {
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            category: {
              type: "string",
              enum: [
                "symptom",
                "location",
                "onset",
                "duration",
                "severity",
                "character",
                "aggravating_factor",
                "relieving_factor",
                "associated_symptom",
                "medical_history",
                "medication",
                "allergy",
              ],
            },
            value: {
              type: "string",
              description: "The extracted clinical value in concise form",
            },
          },
          required: ["category", "value"],
        },
        description: "Array of clinical findings to record",
      },
    },
    required: ["findings"],
  },
};
