import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import TextArea, { TextAreaHandle } from "../../shared/TextArea";
import Spinner from "../../shared/Spinner";
import TypingIndicator from "../../shared/TypingIndicator";
import DemographicsForm from "../DemographicsForm";
import {
  getConversation,
  streamAIResponse,
  sendFollowUp,
  submitDemographics,
} from "../../services/api";
import type { ToolUseData } from "../../services/api";

// Check if message content is a JSON content block array
const tryParseContent = (content: string) => {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return null;
};

// Extract display text from a message that may have JSON content blocks
const getDisplayContent = (
  msg: any,
): { text: string; toolUse?: ToolUseData; isToolResult?: boolean } => {
  const blocks = tryParseContent(msg.content);
  if (!blocks) return { text: msg.content };

  // Assistant message with tool_use
  if (msg.role === "assistant") {
    const textBlock = blocks.find((b: any) => b.type === "text");
    const toolBlock = blocks.find((b: any) => b.type === "tool_use");
    return {
      text: textBlock?.text || "",
      toolUse: toolBlock
        ? { id: toolBlock.id, name: toolBlock.name, input: toolBlock.input }
        : undefined,
    };
  }

  // User message with tool_result
  if (msg.role === "user") {
    const toolResult = blocks.find((b: any) => b.type === "tool_result");
    if (toolResult) {
      return { text: toolResult.content || "", isToolResult: true };
    }
  }

  return { text: msg.content };
};

const Conversation = () => {
  const { conversationId } = useParams();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingToolUse, setPendingToolUse] = useState<ToolUseData | null>(
    null,
  );
  const [demographicsSubmitted, setDemographicsSubmitted] = useState(false);
  const textAreaRef = useRef<TextAreaHandle>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startStream = (cId: string) => {
    // Close any stale EventSource before opening a new one
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setWaiting(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    eventSourceRef.current = streamAIResponse(
      cId,
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
        eventSourceRef.current = null;
        textAreaRef.current?.focus();
      },
      (toolUse) => {
        setPendingToolUse(toolUse);
        setWaiting(false);
      },
    );
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await getConversation(conversationId!);
        setMessages(data.messages);
        setLoading(false);

        const msgs = data.messages;
        const lastMessage = msgs[msgs.length - 1];

        // Reload recovery: check if last assistant message has a tool_use block
        // with no following tool_result — re-show the form
        if (lastMessage?.role === "assistant") {
          const parsed = tryParseContent(lastMessage.content);
          if (parsed) {
            const toolBlock = parsed.find((b: any) => b.type === "tool_use");
            if (toolBlock) {
              // Check there's no tool_result after it
              setPendingToolUse({
                id: toolBlock.id,
                name: toolBlock.name,
                input: toolBlock.input,
              });
              return;
            }
          }
        }

        if (lastMessage?.role === "user") {
          // Check if this is a tool_result message — if so, stream the AI continuation
          const parsed = tryParseContent(lastMessage.content);
          const isToolResult = parsed?.some(
            (b: any) => b.type === "tool_result",
          );
          if (isToolResult) {
            startStream(conversationId!);
            return;
          }

          startStream(conversationId!);
        }
      } catch (err) {
        console.log("Error loading conversation", err);
        setWaiting(false);
      }
    };
    init();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingToolUse]);

  const handleDemographicsSubmit = async (
    age: number,
    biologicalSex: string,
  ) => {
    if (!pendingToolUse || !conversationId) return;
    setDemographicsSubmitted(true);

    try {
      await submitDemographics(
        conversationId,
        pendingToolUse.id,
        age,
        biologicalSex,
      );
      setPendingToolUse(null);
      setDemographicsSubmitted(false);

      // Stream the AI continuation
      startStream(conversationId);
    } catch (err) {
      console.log("Error submitting demographics", err);
      setDemographicsSubmitted(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || waiting || sending || pendingToolUse) return;

    const text = message.trim();
    setMessage("");
    setSending(true);

    try {
      await sendFollowUp(conversationId!, text);
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setSending(false);

      startStream(conversationId!);
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

  const inputDisabled = waiting || !!pendingToolUse;

  return (
    <div className="min-h-screen bg-body flex flex-col">
      <div className="max-w-2xl w-full mx-auto flex flex-col flex-1">
        <div className="font-ddn font-semibold text-3xl pt-8 pb-4">
          Dr. Bogan
        </div>
        <div className="flex-1 py-4">
          {messages.map((msg, i) => {
            const { text, toolUse, isToolResult } = getDisplayContent(msg);

            // Hide empty streaming placeholder
            if (msg.role === "assistant" && !text && !toolUse && waiting)
              return null;

            // Render tool_result messages as a styled summary
            if (isToolResult) {
              return (
                <div key={i} className="flex py-1 justify-start">
                  <div className="font-fakt text-sm px-4 py-2 rounded-2xl bg-gray-100 text-gray-500 rounded-bl-sm max-w-[80%]">
                    {text}
                  </div>
                </div>
              );
            }

            return (
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
                  {text}
                </div>
              </div>
            );
          })}
          {waiting && messages[messages.length - 1]?.content === "" && (
            <TypingIndicator />
          )}
          {pendingToolUse && (
            <DemographicsForm
              onSubmit={handleDemographicsSubmit}
              disabled={demographicsSubmitted}
            />
          )}
          <div ref={bottomRef} />
        </div>
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
              {sending ? (
                <Spinner />
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || inputDisabled}
                  className={`p-2 rounded-full text-white ${message.trim() && !inputDisabled ? "bg-black" : "bg-gray-300"}`}
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Conversation;
