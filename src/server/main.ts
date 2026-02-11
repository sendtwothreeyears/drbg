import "dotenv/config";
import express from "express";
import ViteExpress from "vite-express";
import { streamMessage, generateTitle } from "./api";
import {
  createConversation,
  getConversation,
  updateConversationTitle,
  getAllConversations,
} from "./db/queries/conversations";
import {
  createMessage,
  getMessagesByConversation,
  getLastUserMessage,
} from "./db/queries/messages";
import { createProfile, getProfileByConversation } from "./db/queries/profiles";
import {
  createFindings,
  getFindingsByConversation,
} from "./db/queries/findings";
import { buildClinicalInterviewPrompt } from "./prompts/CLINICAL_INTERVIEW";
import { collectDemographicsTool } from "./tools/demographics";
import { recordClinicalFindingTool } from "./tools/extraction";

const app = express();
const router = express.Router();

app.use(express.json());
app.use("/api", router);

const tryParseJSON = (str: string) => {
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return null;
};

type LoopResult = "done" | "awaiting_client";

async function runStreamLoop(
  conversationId: string,
  sseSend: (data: object) => void,
  isClosed: () => boolean,
): Promise<LoopResult> {
  // Rebuild history fresh each iteration
  const allMessages: any[] = getMessagesByConversation(conversationId);
  const history = allMessages
    .map((m) => {
      const jsonContent = tryParseJSON(m.content);
      return {
        role: m.role as "user" | "assistant",
        content: jsonContent || m.content,
      };
    })
    .filter((_, i, arr) => !(i === 0 && arr[0].role === "assistant"));

  // Look up profile + findings, build prompt, set tools
  const profile: any = getProfileByConversation(conversationId);
  const findings = profile
    ? getFindingsByConversation(conversationId)
    : undefined;
  const systemPrompt = buildClinicalInterviewPrompt(
    profile || undefined,
    findings,
  );
  const tools = profile
    ? [recordClinicalFindingTool]
    : [collectDemographicsTool];

  // Stream the response
  let fullText = "";
  const toolUseBlocks: { id: string; name: string; input: any }[] = [];

  const stream = streamMessage({ messages: history, system: systemPrompt, tools });
  stream.finalMessage().catch(() => {});

  return new Promise<LoopResult>((resolve, reject) => {
    stream.on("text", (text) => {
      if (isClosed()) return;
      fullText += text;
      sseSend({ text });
    });

    stream.on("contentBlock", (block) => {
      if (isClosed()) return;
      if (block.type === "tool_use") {
        toolUseBlocks.push({ id: block.id, name: block.name, input: block.input });
      }
    });

    stream.on("error", (err) => {
      console.error("Anthropic stream error:", err);
      if (!isClosed()) {
        sseSend({ error: "Stream failed" });
      }
      reject(err);
    });

    stream.on("end", async () => {
      try {
        // Classify tool blocks
        const silentBlocks = toolUseBlocks.filter(
          (b) => b.name === "record_clinical_finding",
        );
        const clientBlocks = toolUseBlocks.filter(
          (b) => b.name !== "record_clinical_finding",
        );

        // Save assistant message
        if (toolUseBlocks.length > 0) {
          const contentBlocks: any[] = [];
          if (fullText) {
            contentBlocks.push({ type: "text", text: fullText });
          }
          for (const block of toolUseBlocks) {
            contentBlocks.push({
              type: "tool_use",
              id: block.id,
              name: block.name,
              input: block.input,
            });
          }
          createMessage(
            conversationId,
            "assistant",
            JSON.stringify(contentBlocks),
          );
        } else {
          createMessage(conversationId, "assistant", fullText);
        }

        // Handle silent tools (record_clinical_finding) — save and finish, no loop
        if (silentBlocks.length > 0) {
          for (const block of silentBlocks) {
            const input = block.input as { findings: { category: string; value: string }[] };
            createFindings(conversationId, input.findings);

            // Save tool_result message so history is well-formed for next turn
            const toolResultContent = JSON.stringify([
              {
                type: "tool_result",
                tool_use_id: block.id,
                content: `Recorded ${input.findings.length} clinical finding(s).`,
              },
            ]);
            createMessage(conversationId, "user", toolResultContent);
          }
          resolve("done");
          return;
        }

        // Handle client tools (collect_demographics)
        if (clientBlocks.length > 0) {
          for (const block of clientBlocks) {
            if (!isClosed()) {
              sseSend({ tool_use: block });
            }
          }
          resolve("awaiting_client");
          return;
        }

        // No tools — we're done
        resolve("done");
      } catch (err) {
        console.error("Failed to process stream end:", err);
        reject(err);
      }
    });
  });
}

router.post("/create", (req, res) => {
  const { message } = req.body;
  const conversationId = createConversation();
  createMessage(
    conversationId,
    "assistant",
    "I'll help you work through your symptoms. Let's take a closer look.",
  );
  createMessage(conversationId, "user", message);

  res.json({ conversationId });
});

router.post("/conversation/:conversationId/message", (req, res) => {
  const { conversationId } = req.params;
  const { message } = req.body;
  createMessage(conversationId, "user", message);
  res.json({ success: true });
});

router.get("/conversation/:conversationId/stream", async (req, res) => {
  const { conversationId } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const sseSend = (data: object) => {
    if (!closed) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  try {
    const result = await runStreamLoop(
      conversationId,
      sseSend,
      () => closed,
    );

    if (result === "done" && !closed) {
      sseSend({ done: true });
      res.end();
    } else if (result === "awaiting_client" && !closed) {
      sseSend({ done: true });
      res.end();
    }
  } catch {
    if (!closed) {
      sseSend({ error: "Stream failed" });
      res.end();
    }
  }

  // Generate title in the background
  const conv: any = getConversation(conversationId);
  if (!conv?.title) {
    const firstUserMsg: any = getLastUserMessage(conversationId);
    if (firstUserMsg?.content) {
      generateTitle(firstUserMsg.content)
        .then((title) => updateConversationTitle(conversationId, title))
        .catch(() => {});
    }
  }
});

router.post("/conversation/:conversationId/demographics", (req, res) => {
  const { conversationId } = req.params;
  const { toolUseId, age, biologicalSex } = req.body;

  createProfile(conversationId, age, biologicalSex);

  // Save a user-role message with tool_result content
  const toolResultContent = JSON.stringify([
    {
      type: "tool_result",
      tool_use_id: toolUseId,
      content: `Patient demographics collected: Age ${age}, Sex ${biologicalSex}`,
    },
  ]);
  createMessage(conversationId, "user", toolResultContent);

  res.json({ success: true });
});

router.get("/conversations", (_req, res) => {
  const conversations = getAllConversations();
  res.json({ conversations });
});

router.get("/conversation/:conversationId/findings", (req, res) => {
  const { conversationId } = req.params;
  const findings = getFindingsByConversation(conversationId);
  res.json({ findings });
});

router.get("/conversation/:conversationId", (req, res) => {
  const { conversationId } = req.params;
  const messages = getMessagesByConversation(conversationId);
  res.json({ conversationId, messages });
});

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
