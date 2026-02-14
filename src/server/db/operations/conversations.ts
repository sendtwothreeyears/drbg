import pool from "../";
import { randomUUID } from "crypto";
import type { Conversation } from "../../../types";

const createConversationMutation = async (): Promise<string> => {
  const id = randomUUID();
  await pool.query("INSERT INTO conversations (conversationid) VALUES ($1)", [id]);
  return id;
};

const getConversationQuery = async (id: string): Promise<Conversation | undefined> => {
  const { rows } = await pool.query(
    "SELECT * FROM conversations WHERE conversationid = $1",
    [id],
  );
  return rows[0] as Conversation | undefined;
};

const updateConversationTitleMutation = async (id: string, title: string): Promise<void> => {
  await pool.query(
    "UPDATE conversations SET title = $1 WHERE conversationid = $2",
    [title, id],
  );
};

const getAllConversationsQuery = async (): Promise<Conversation[]> => {
  const { rows } = await pool.query(
    "SELECT conversationid, title, created_at FROM conversations ORDER BY created_at DESC",
  );
  return rows as Conversation[];
};

const markConversationCompletedMutation = async (id: string): Promise<void> => {
  await pool.query(
    "UPDATE conversations SET completed = TRUE WHERE conversationid = $1",
    [id],
  );
};

export {
  createConversationMutation,
  getConversationQuery,
  updateConversationTitleMutation,
  getAllConversationsQuery,
  markConversationCompletedMutation,
};
