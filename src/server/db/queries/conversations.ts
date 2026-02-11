import db from "../";
import { randomUUID } from "crypto";

const createConversation = () => {
  const id = randomUUID();
  db.prepare("INSERT INTO conversations (conversationid) VALUES (?)").run(id);
  return id;
};

const getConversation = (id: string) => {
  return db
    .prepare("SELECT * FROM conversations WHERE conversationid = ?")
    .get(id);
};

const updateConversationTitle = (id: string, title: string) => {
  db.prepare("UPDATE conversations SET title = ? WHERE conversationid = ?").run(
    title,
    id,
  );
};

const getAllConversations = () => {
  return db
    .prepare(
      "SELECT conversationid, title, created_at FROM conversations ORDER BY created_at DESC",
    )
    .all();
};

export {
  createConversation,
  getConversation,
  updateConversationTitle,
  getAllConversations,
};
