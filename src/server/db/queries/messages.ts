import pool from "../";
import { randomUUID } from "crypto";

import { Message } from "../../../types";

const createMessage = async (
  conversationId: string,
  role: "user" | "assistant",
  content: string,
): Promise<string> => {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO messages (messageid, conversationid, role, content) VALUES ($1, $2, $3, $4)",
    [id, conversationId, role, content],
  );
  return id;
};

const getMessagesByConversation = async (conversationId: string): Promise<Message[]> => {
  const { rows } = await pool.query(
    "SELECT * FROM messages WHERE conversationid = $1 ORDER BY created_at ASC",
    [conversationId],
  );
  return rows as Message[];
};

const getLastUserMessage = async (conversationId: string): Promise<Message | undefined> => {
  const { rows } = await pool.query(
    "SELECT * FROM messages WHERE conversationid = $1 AND role = 'user' ORDER BY created_at DESC LIMIT 1",
    [conversationId],
  );
  return rows[0] as Message | undefined;
};

export { createMessage, getMessagesByConversation, getLastUserMessage };
