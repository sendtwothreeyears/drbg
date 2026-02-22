import pool from "../";
import { randomUUID } from "crypto";

import { Message } from "../../../types";

const createMessageMutation = async (
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  originalContent?: string | null,
  originalLanguage?: string | null,
): Promise<string> => {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO messages (messageid, conversationid, role, content, original_content, original_language)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, conversationId, role, content, originalContent ?? null, originalLanguage ?? null],
  );
  return id;
};

const getMessagesByConversationQuery = async (conversationId: string): Promise<Message[]> => {
  const { rows } = await pool.query(
    `SELECT messageid, conversationid, role, content,
            original_content, original_language, created_at
     FROM messages
     WHERE conversationid = $1
     ORDER BY created_at ASC`,
    [conversationId],
  );
  return rows as Message[];
};

const getLastUserMessageQuery = async (conversationId: string): Promise<Message | undefined> => {
  const { rows } = await pool.query(
    "SELECT * FROM messages WHERE conversationid = $1 AND role = 'user' ORDER BY created_at DESC LIMIT 1",
    [conversationId],
  );
  return rows[0] as Message | undefined;
};

export { createMessageMutation, getMessagesByConversationQuery, getLastUserMessageQuery };
