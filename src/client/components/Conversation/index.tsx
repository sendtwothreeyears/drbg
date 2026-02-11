import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import TextArea from "../../shared/TextArea";
import Spinner from "../../shared/Spinner";
import { getConversation, streamAIResponse, sendFollowUp } from "../../services/api";

const Conversation = () => {
  const { conversationId } = useParams();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const init = async () => {
      try {
        const { data } = await getConversation(conversationId!);
        setMessages(data.messages);
        setLoading(false);

        const lastMessage = data.messages[data.messages.length - 1];
        if (lastMessage?.role === "user") {
          setWaiting(true);
          setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

          eventSource = streamAIResponse(
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
              setWaiting(false);
            },
          );
        }
      } catch (err) {
        console.log("Error loading conversation", err);
        setWaiting(false);
      }
    };
    init();

    return () => {
      eventSource?.close();
    };
  }, [conversationId]);

  const handleSend = async () => {
    if (!message.trim() || waiting || sending) return;

    const text = message.trim();
    setMessage("");
    setSending(true);

    try {
      await sendFollowUp(conversationId!, text);
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setSending(false);

      setWaiting(true);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      streamAIResponse(
        conversationId!,
        (chunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
            return updated;
          });
        },
        () => {
          setWaiting(false);
        },
      );
    } catch (err) {
      console.log("Error sending follow-up", err);
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-body flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="h-screen bg-body flex flex-col">
      <div className="max-w-lg m-auto py-30 flex flex-col flex-1">
        <div className="font-gt-super font-medium text-3xl">Dr. Bogan</div>
        <div className="flex-1 py-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex py-1 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`font-fakt text-md px-4 py-2 rounded-2xl max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-slate-800 text-white rounded-br-sm"
                    : "bg-white text-gray-800 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {waiting && <Spinner />}
        </div>
        <div className="bg-white p-2 rounded-lg shadow-sm border-gray-200">
          <TextArea
            value={message}
            onChange={setMessage}
            placeholder="Type your message..."
          />
          <div className="flex justify-end">
            {sending ? (
              <Spinner />
            ) : (
              <button onClick={handleSend} className="bg-slate-800 py-2 px-4 rounded-sm text-white">
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Conversation;
