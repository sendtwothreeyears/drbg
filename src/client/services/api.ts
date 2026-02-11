import axios from "axios";

const sendBotMessage = async (message: string) => {
  return await axios.post("/api/create", {
    message,
  });
};

const getConversation = async (conversationId: string) => {
  return await axios.get(`/api/conversation/${conversationId}`);
};

type ToolUseData = {
  id: string;
  name: string;
  input: { reason: string };
};

const streamAIResponse = (
  conversationId: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onToolUse?: (toolUse: ToolUseData) => void,
) => {
  const eventSource = new EventSource(
    `/api/conversation/${conversationId}/stream`,
  );

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.tool_use) {
      if (onToolUse) {
        onToolUse(data.tool_use);
      }
    } else if (data.done) {
      eventSource.close();
      onDone();
    } else if (data.error) {
      eventSource.close();
      onDone();
    } else {
      onChunk(data.text);
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    onDone();
  };

  return eventSource;
};

const sendFollowUp = async (conversationId: string, message: string) => {
  return await axios.post(`/api/conversation/${conversationId}/message`, {
    message,
  });
};

const getFindings = async (conversationId: string) => {
  return await axios.get(`/api/conversation/${conversationId}/findings`);
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

export {
  sendBotMessage,
  getConversation,
  getFindings,
  streamAIResponse,
  sendFollowUp,
  getAllConversations,
  submitDemographics,
};

export type { ToolUseData };
