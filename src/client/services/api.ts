import axios from "axios";

const sendBotMessage = async (message: string) => {
  return await axios.post("/api/create", {
    message,
  });
};

const getConversation = async (conversationId: string) => {
  return await axios.get(`/api/conversation/${conversationId}`);
};

const streamAIResponse = (
  conversationId: string,
  onChunk: (text: string) => void,
  onDone: () => void,
) => {
  const eventSource = new EventSource(
    `/api/conversation/${conversationId}/stream`,
  );

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.done) {
      eventSource.close();
      onDone();
    } else if (data.error) {
      eventSource.close();
    } else {
      onChunk(data.text);
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
  };

  return eventSource;
};

const sendFollowUp = async (conversationId: string, message: string) => {
  return await axios.post(`/api/conversation/${conversationId}/message`, {
    message,
  });
};

export { sendBotMessage, getConversation, streamAIResponse, sendFollowUp };
