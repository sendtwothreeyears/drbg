import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import TextArea, { TextAreaHandle } from "../../shared/TextArea";
import { startStream } from "../../services/stream";

const Conversation = () => {
  const { conversationId } = useParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [streaming, setStreaming] = useState(false);
  const textAreaRef = useRef<TextAreaHandle>(null);

  // Helper functions

  const streamResponse = () => {
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    startStream(
      conversationId!,
      (text) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            content: last.content + text,
          };
          return updated;
        });
      },
      () => {
        setStreaming(false);
        textAreaRef.current?.focus();
      },
    );
  };

  // Component mounting

  useEffect(() => {
    const load = async () => {
      const { data } = await axios.get(`/api/conversation/${conversationId}`);
      setMessages(data.messages);
      textAreaRef.current?.focus();

      const lastMessage = data.messages[data.messages.length - 1];
      if (lastMessage?.role === "user") {
        streamResponse();
      }
    };
    load();
  }, [conversationId]);

  const handleSend = async () => {
    if (!message.trim() || streaming) return;
    const text = message.trim();
    setMessage("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    await axios.post(`/api/conversation/${conversationId}/message`, {
      message: text,
    });
    streamResponse();
  };

  const renderMessages = () =>
    messages.map((msg, i) => (
      <div
        key={i}
        className={`flex py-1 ${
          msg.role === "user" ? "justify-end" : "justify-start"
        }`}
      >
        <div
          className={`font-fakt text-lg px-4 py-2 rounded-2xl max-w-[80%] ${
            msg.role === "user"
              ? "bg-slate-800 text-white rounded-br-sm"
              : "bg-white text-gray-800 rounded-bl-sm"
          }`}
        >
          {msg.content}
        </div>
      </div>
    ));

  return (
    <div className="min-h-screen bg-body flex">
      <div className="flex flex-col flex-1 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between pt-8 pb-4">
          <div className="font-ddn font-semibold text-3xl">Dr. Bogan</div>
        </div>

        {/* Messages area */}
        <div className="flex-1 py-4">{renderMessages()}</div>

        {/* Input area */}
        <div className="sticky bottom-0 bg-body pb-4">
          <div className="bg-white p-2 rounded-lg shadow-sm border-gray-200">
            <TextArea
              ref={textAreaRef}
              value={message}
              onChange={setMessage}
              onSubmit={handleSend}
              placeholder="Type your message..."
            />
            <div className="flex justify-end">
              <button
                onClick={handleSend}
                disabled={!message.trim() || streaming}
                className={`p-2 rounded-full text-white ${message.trim() && !streaming ? "bg-black" : "bg-gray-300"}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"
                    transform="rotate(-90 12 12)"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Conversation;
