import db from "../";
import { randomUUID } from "crypto";

const createConversation = () => {
  const newConversationId = randomUUID();
};

const getConversation = (id: string) => {};

export { createConversation, getConversation };
