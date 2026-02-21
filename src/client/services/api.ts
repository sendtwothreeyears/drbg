import axios from "axios";
import type { Finding } from "../../types";

const createNewConversation = async (message: string, language: string = "en") => {
  return await axios.post<{ conversationId: string }>("/api/create", {
    message,
    language,
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

const getDiagnoses = async (conversationId: string) => {
  return await axios.get(
    `/api/conversation/${conversationId}/diagnoses`,
  );
};

export {
  createNewConversation,
  // getAllConversations,
  submitDemographics,
  getFindings,
  getDiagnoses,
};
