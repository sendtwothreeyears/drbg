import Anthropic from "@anthropic-ai/sdk";
import prompts from "./prompts";

const client = new Anthropic({
  apiKey: process.env["ANTHROPIC_API_KEY"],
});
