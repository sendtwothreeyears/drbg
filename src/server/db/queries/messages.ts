import db from "../";
import { randomUUID } from "crypto";

const createMessage = (
  conversationId: string,
  role: string,
  content: string,
) => {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO messages (messageid, conversationid, role, content) VALUES (?, ?, ?, ?)",
  ).run(id, conversationId, role, content);
  return id;
};

const getMessagesByConversation = (conversationId: string) => {
  return db
    .prepare(
      "SELECT * FROM messages WHERE conversationid = ? ORDER BY created_at ASC",
    )
    .all(conversationId);
};

const getLastUserMessage = (conversationId: string) => {
  return db
    .prepare(
      "SELECT * FROM messages WHERE conversationid = ? AND role = 'user' ORDER BY created_at DESC LIMIT 1",
    )
    .get(conversationId);
};

export { createMessage, getMessagesByConversation, getLastUserMessage };
