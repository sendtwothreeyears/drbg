import express from "express";
import { createConversation } from "../db/queries/conversations";
import {
  createMessage,
  getMessagesByConversation,
} from "../db/queries/messages";
import {
  createProfile,
  getProfileByConversation,
} from "../db/queries/profiles";
import { getFindingsByConversation } from "../db/queries/findings";
import { runStream } from "../services/conversation";

const router = express.Router();

router.get("/conversation/:conversationId/stream", async (req, res) => {
  // SSE - Stream initialization
  const { conversationId } = req.params;

  // Prepares the headers in memory, not sent
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Send them to client immediately to start the stream, and writes data later
  res.flushHeaders();

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  const send = (data: object) => {
    // each res.write() during stream writes back to the response body
    if (!closed) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const profile = getProfileByConversation(conversationId);
  const toolName = profile ? undefined : "collect_demographics";

  await runStream(
    conversationId,
    // onText -> sends chunked messages back to client
    (text) => send({ text }),
    // onTool -> sends chunked messages back to client, notifies if there is a tool
    (tool) => send({ tool }),
    // onDone -> sends final message back to user, ends connection
    () => {
      send({ done: true });
      res.end();
    },
    // OnError
    () => {
      send({ error: "Stream failed" });
      res.end();
    },
    toolName,
  );
});

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

router.post("/conversation/:conversationId/demographics", (req, res) => {
  const { conversationId } = req.params;
  const { toolUseId, age, biologicalSex } = req.body;

  createProfile(conversationId, age, biologicalSex);

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

export default router;
