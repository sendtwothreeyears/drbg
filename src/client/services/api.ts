import axios from "axios";
import type { Finding } from "../../types";

const createNewConversation = async (message: string) => {
  return await axios.post<{ conversationId: string }>("/api/create", {
    message,
  });
};

const submitDemographics = async (
  conversationId: string,
  toolUseId: string,
  age: number,
  biologicalSex: string,
) => {
  return await axios.post<{ success: boolean }>(
    `/api/conversation/${conversationId}/demographics`,
    { toolUseId, age, biologicalSex },
  );
};

const getFindings = async (conversationId: string) => {
  return await axios.get<{ findings: Finding[] }>(
    `/api/conversation/${conversationId}/findings`,
  );
};

export {
  createNewConversation,
  // getAllConversations,
  submitDemographics,
  getFindings,
};
