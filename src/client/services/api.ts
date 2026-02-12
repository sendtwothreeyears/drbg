import axios from "axios";

const createNewConversation = async (message: string) => {
  return await axios.post("/api/create", {
    message,
  });
};

const getAllConversations = async () => {
  return await axios.get("/api/conversations");
};

const submitDemographics = async (
  conversationId: string,
  toolUseId: string,
  age: number,
  biologicalSex: string,
) => {
  return await axios.post(
    `/api/conversation/${conversationId}/demographics`,
    { toolUseId, age, biologicalSex },
  );
};

const getFindings = async (conversationId: string) => {
  return await axios.get(`/api/conversation/${conversationId}/findings`);
};

export { createNewConversation, getAllConversations, submitDemographics, getFindings };
