import axios from "axios";

const sendBotMessage = async (message: string) => {
  return await axios.post("/api/create", {
    message,
  });
};

export { sendBotMessage };
