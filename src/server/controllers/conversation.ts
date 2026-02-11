import express from "express";
import { createConversation } from "../db/queries/conversations";
import { createMessage, getMessagesByConversation } from "../db/queries/messages";

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

router.get("/conversation/:conversationId", (req, res) => {
  const { conversationId } = req.params;
  const messages = getMessagesByConversation(conversationId);
  res.json({ conversationId, messages });
});

export default router;
