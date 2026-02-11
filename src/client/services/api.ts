import axios from "axios";

const createNewConversation = async (message: string) => {
  return await axios.post("/api/create", {
    message,
  });
};

const getAllConversations = async () => {
  return await axios.get("/api/conversations");
};

export { createNewConversation, getAllConversations };
