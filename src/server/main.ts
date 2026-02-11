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
import { buildClinicalInterviewPrompt } from "./prompts/CLINICAL_INTERVIEW";
import { collectDemographicsTool } from "./tools/demographics";

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
  const allMessages: any[] = getMessagesByConversation(conversationId);

  // Build message history — parse JSON content blocks for tool_use/tool_result messages
  const history = allMessages
    .map((m) => {
      const jsonContent = tryParseJSON(m.content);
      return {
        role: m.role as "user" | "assistant",
        content: jsonContent || m.content,
      };
    })
    .filter((_, i, arr) => !(i === 0 && arr[0].role === "assistant"));

  // Look up profile and build system prompt
  const profile: any = getProfileByConversation(conversationId);
  const systemPrompt = buildClinicalInterviewPrompt(profile || undefined);
  const tools = profile ? undefined : [collectDemographicsTool];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullText = "";
  let toolUseBlock: { id: string; name: string; input: any } | null = null;
  let closed = false;
  const stream = streamMessage({ messages: history, system: systemPrompt, tools });
  // Swallow async rejections from abort so they don't crash the process
  stream.finalMessage().catch(() => {});

  req.on("close", () => {
    closed = true;
    try { stream.abort(); } catch {}
  });

  stream.on("text", (text) => {
    if (closed) return;
    fullText += text;
    res.write(`data: ${JSON.stringify({ text })}\n\n`);
  });

  stream.on("contentBlock", (block) => {
    if (closed) return;
    if (block.type === "tool_use") {
      toolUseBlock = { id: block.id, name: block.name, input: block.input };
      res.write(
        `data: ${JSON.stringify({ tool_use: toolUseBlock })}\n\n`,
      );
    }
  });

  stream.on("end", () => {
    try {
      if (toolUseBlock) {
        // Save assistant message as JSON content array (text block + tool_use block)
        const contentBlocks: any[] = [];
        if (fullText) {
          contentBlocks.push({ type: "text", text: fullText });
        }
        contentBlocks.push({
          type: "tool_use",
          id: toolUseBlock.id,
          name: toolUseBlock.name,
          input: toolUseBlock.input,
        });
        createMessage(conversationId, "assistant", JSON.stringify(contentBlocks));
      } else {
        createMessage(conversationId, "assistant", fullText);
      }
    } catch (err) {
      console.error("Failed to save assistant message:", err);
    }

    if (!closed) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
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

  stream.on("error", (err) => {
    console.error("Anthropic stream error:", err);
    if (closed) return;
    res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
    res.end();
  });
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

router.get("/conversation/:conversationId", (req, res) => {
  const { conversationId } = req.params;
  const messages = getMessagesByConversation(conversationId);
  res.json({ conversationId, messages });
});

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
