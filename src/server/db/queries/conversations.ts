import db from "../";
import { randomUUID } from "crypto";
import type { Conversation } from "../../../types";

const createConversation = (): string => {
  const id = randomUUID();
  db.prepare("INSERT INTO conversations (conversationid) VALUES (?)").run(id);
  return id;
};

const getConversation = (id: string): Conversation | undefined => {
  return db
    .prepare("SELECT * FROM conversations WHERE conversationid = ?")
    .get(id) as Conversation | undefined;
};

const updateConversationTitle = (id: string, title: string): void => {
  db.prepare("UPDATE conversations SET title = ? WHERE conversationid = ?").run(
    title,
    id,
  );
};

const getAllConversations = (): Conversation[] => {
  return db
    .prepare(
      "SELECT conversationid, title, created_at FROM conversations ORDER BY created_at DESC",
    )
    .all() as Conversation[];
};

export {
  createConversation,
  getConversation,
  updateConversationTitle,
  getAllConversations,
};
