import { collectDemographicsTool } from "./collect_demographics";
import { recordClinicalFindingTool } from "./record_clinical_finding";
import Anthropic from "@anthropic-ai/sdk";

const tools: Record<string, Anthropic.Tool> = {
  collect_demographics: collectDemographicsTool,
  record_clinical_finding: recordClinicalFindingTool,
};

export default tools;
