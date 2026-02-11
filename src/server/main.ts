import "dotenv/config";
import express from "express";
import ViteExpress from "vite-express";
import { streamMessage } from "./api";
import { createConversation } from "./db/queries/conversations";
import {
  createMessage,
  getMessagesByConversation,
} from "./db/queries/messages";

const PROMPT_KEY = "CLINICAL_INTERVIEW";

const app = express();
const router = express.Router();

app.use(express.json());
app.use("/api", router);

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

  // Filter out the leading assistant greeting — Anthropic API requires messages start with "user"
  const history = allMessages
    .map((m) => ({ role: m.role, content: m.content }))
    .filter((_, i, arr) => !(i === 0 && arr[0].role === "assistant"));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullContent = "";
  const stream = streamMessage(history, PROMPT_KEY);

  stream.on("text", (text) => {
    fullContent += text;
    res.write(`data: ${JSON.stringify({ text })}\n\n`);
  });

  stream.on("end", () => {
    createMessage(conversationId, "assistant", fullContent);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  });

  stream.on("error", (err) => {
    res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
    res.end();
  });
});

router.get("/conversation/:conversationId", (req, res) => {
  const { conversationId } = req.params;
  const messages = getMessagesByConversation(conversationId);
  res.json({ conversationId, messages });
});

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
