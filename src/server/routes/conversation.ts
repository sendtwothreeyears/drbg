import express from "express";
import {
  createConversation,
  getConversation,
} from "../db/queries/conversations";
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
import type { StreamEvent } from "../../types";

const router = express.Router();

router.get("/conversation/:conversationId/stream", async (req, res) => {
  // SSE - Stream initialization
  const { conversationId } = req.params;

  // Tells the browser "this is an SSE stream, not a normal response"
  res.setHeader("Content-Type", "text/event-stream");
  // Tells the browser "don't cache this, it's live data"
  res.setHeader("Cache-Control", "no-cache");
  // Tells the browser "keep this connection open, more data is coming"
  res.setHeader("Connection", "keep-alive");
  // Flush =  Send them to client immediately to start the stream where EventSource is listening.
  // We don't wait until data is available, we make sure the stream is active first and then actively write to it.
  res.flushHeaders();

  let closed = false;
  // when browser tab closed, or client's eventSource.close() called
  req.on("close", () => {
    closed = true;
  });

  const send = (data: StreamEvent) => {
    // each res.write() during stream writes back to the response body
    if (!closed) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const profile = await getProfileByConversation(conversationId);
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

router.post("/create", async (req, res) => {
  const { message } = req.body;
  const conversationId = await createConversation();
  await createMessage(
    conversationId,
    "assistant",
    "I'll help you work through your symptoms. Let's take a closer look.",
  );
  await createMessage(conversationId, "user", message);
  res.json({ conversationId });
});

router.post("/conversation/:conversationId/message", async (req, res) => {
  const { conversationId } = req.params;
  const { message } = req.body;
  await createMessage(conversationId, "user", message);
  res.json({ success: true });
});

router.post("/conversation/:conversationId/demographics", async (req, res) => {
  const { conversationId } = req.params;
  const { toolUseId, age, biologicalSex } = req.body;

  await createProfile(conversationId, age, biologicalSex);

  const toolResultContent = JSON.stringify([
    {
      type: "tool_result",
      tool_use_id: toolUseId,
      content: `Patient demographics collected: Age ${age}, Sex ${biologicalSex}`,
    },
  ]);
  await createMessage(conversationId, "user", toolResultContent);

  res.json({ success: true });
});

router.get("/conversation/:conversationId/findings", async (req, res) => {
  const { conversationId } = req.params;
  const findings = await getFindingsByConversation(conversationId);
  res.json({ findings });
});

router.get("/conversation/:conversationId", async (req, res) => {
  const { conversationId } = req.params;
  const conversation = await getConversation(conversationId);
  const messages = await getMessagesByConversation(conversationId);
  res.json({ conversationId, createdAt: conversation?.created_at, messages });
});

export default router;
