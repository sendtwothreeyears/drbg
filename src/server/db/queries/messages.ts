import db from "../";
import { randomUUID } from "crypto";

import { Message } from "../../../types";

const createMessage = (
  conversationId: string,
  role: "user" | "assistant",
  content: string,
): string => {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO messages (messageid, conversationid, role, content) VALUES (?, ?, ?, ?)",
  ).run(id, conversationId, role, content);
  return id;
};

const getMessagesByConversation = (conversationId: string): Message[] => {
  return db
    .prepare(
      "SELECT * FROM messages WHERE conversationid = ? ORDER BY created_at ASC",
    )
    .all(conversationId) as Message[];
};

const getLastUserMessage = (conversationId: string): Message | undefined => {
  return db
    .prepare(
      "SELECT * FROM messages WHERE conversationid = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1",
    )
    .get(conversationId) as Message | undefined;
};

export { createMessage, getMessagesByConversation, getLastUserMessage };
