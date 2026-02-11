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

export { createConversation, getConversation };
