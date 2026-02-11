import express from "express";
import { createConversation } from "../db/queries/conversations";
import { createMessage, getMessagesByConversation } from "../db/queries/messages";
import { getProfileByConversation } from "../db/queries/profiles";
import { runStream } from "../services/conversation";

const router = express.Router();

router.post("/create", (req, res) => {
  const { message } = req.body;
  const conversationId = createConversation();
  createMessage(conversationId, "assistant", "I'll help you work through your symptoms. Let's take a closer look.");
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
  req.on("close", () => { closed = true; });

  const send = (data: object) => {
    if (!closed) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const profile = getProfileByConversation(conversationId);
  const toolName = profile ? undefined : "collect_demographics";

  await runStream(
    conversationId,
    (text) => send({ text }),
    (tool) => send({ tool }),
    () => { send({ done: true }); res.end(); },
    () => { send({ error: "Stream failed" }); res.end(); },
    toolName,
  );
});

router.get("/conversation/:conversationId", (req, res) => {
  const { conversationId } = req.params;
  const messages = getMessagesByConversation(conversationId);
  res.json({ conversationId, messages });
});

export default router;
