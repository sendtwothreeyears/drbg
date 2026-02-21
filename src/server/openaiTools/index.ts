import { collectDemographicsTool } from "./collect_demographics";
import { generateDifferentialsTool } from "./generate_differentials";
import type { OpenAITool } from "../services/openai-chat";

const tools: Record<string, OpenAITool> = {
  collect_demographics: collectDemographicsTool,
  generate_differentials: generateDifferentialsTool,
};

export default tools;
