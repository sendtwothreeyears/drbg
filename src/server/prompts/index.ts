import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const prompts: Record<string, string> = {};

const files = fs.readdirSync(__dirname).filter(
  (f) => f.endsWith(".ts") && f !== "index.ts",
);

for (const file of files) {
  const key = file.replace(".ts", "");
  const mod = await import(`./${file}`);
  prompts[key] = mod.default;
}

export default prompts;
