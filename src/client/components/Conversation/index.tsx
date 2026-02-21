// GLOBAL IMPORTS
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

// SERVICES LAYER
import { submitDemographics } from "../../services/api";

// COMPONENTS
import TextArea, { TextAreaHandle } from "../../shared/TextArea";
import TypingIndicator from "../../shared/TypingIndicator";
import DemographicsForm from "./DemographicsForm";
import DiagnosisPanel from "./DiagnosisPanel";
import FindingsPanel, { FindingsPanelHandle } from "./FindingsPanel";
import LoadingPanel from "./LoadingPanel";
import Accordion from "../../shared/Accordion";
import ReactMarkdown from "react-markdown";

// UTILITY IMPORTS
import { startStream, ToolUseEvent } from "../../services/stream";
import {
  getDisplayText,
  formatConsultDate,
  formatSummaryDate,
} from "../../utils";

const Conversation = () => {
  const { conversationId } = useParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingTool, setPendingTool] = useState<ToolUseEvent | null>(null);
  const [showFindings, setShowFindings] = useState(false);
  const [showDiagnoses, setShowDiagnoses] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessment, setAssessment] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const textAreaRef = useRef<TextAreaHandle>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const findingsRef = useRef<FindingsPanelHandle>(null);

  const streamResponse = () => {
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    // Only start stream with the message to add is from an ASSISTANT
    startStream(
      conversationId!,
      // onText
      (text) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = {
            ...last,
            // adding the chunk
            content: last.content + text,
          };
          return updated;
        });
      },
      // onToolUse - how we use the tool that is returned
      (tool) => {
        setPendingTool(tool);
        // if we have a tool - the stream has already ended
        // reset streaming UI behavior
        setStreaming(false);
      },
      // onAssessmentLoading
      () => {
        setCompleted(true);
        setAssessmentLoading(true);
        setStreaming(false);
      },
      // onDone
      (meta) => {
        setStreaming(false);
        setAssessmentLoading(false);
        if (meta?.diagnoses) {
          setCompleted(true);
          setAssessment(meta.assessment);
          setShowDiagnoses(true);
        } else {
          textAreaRef.current?.focus();
        }
        findingsRef.current?.refresh();
      },
      // onError
      (errorMsg) => {
        setStreaming(false);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.content) {
            return prev.slice(0, -1);
          }
          return prev;
        });
        setError("The response could not be completed. Please try again.");
      },
    );
  };

  const handleDemographicsSubmit = async (
    age: number,
    biologicalSex: string,
  ) => {
    await submitDemographics(
      conversationId!,
      pendingTool!.id,
      age,
      biologicalSex,
    );
    setPendingTool(null);
    streamResponse();
  };

  const handleSend = async () => {
    if (!message.trim() || streaming) return;
    const text = message.trim();
    setMessage("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      await axios.post(`/api/conversation/${conversationId}/message`, {
        message: text,
        language,
      });
      // When the page loads, and the last message is a completed message from the
      // AI, the streaming response kicks off again AFTER the user submits a message.
      streamResponse();
    } catch (err: any) {
      setMessages((prev) => prev.slice(0, -1));
      setMessage(text);
      if (err.response?.data?.error === "translation_failed") {
        setError("Unable to translate your message. Please try again or switch to English.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  const renderMessages = () =>
    messages
      .filter((msg) => msg.content)
      .map((msg, i) => (
        <div
          key={i}
          className={`flex py-1 ${
            msg.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`font-fakt text-lg px-4 py-2 rounded-2xl max-w-[80%] ${
              msg.role === "user"
                ? "bg-main text-white rounded-br-sm"
                : "bg-white text-gray-800 rounded-bl-sm"
            }`}
          >
            {language !== "en" && msg.original_content
              ? msg.original_content
              : getDisplayText(msg.content)}
          </div>
        </div>
      ));

  // Scroll Down after every new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Component Mounting
  useEffect(() => {
    const load = async () => {
      const { data } = await axios.get(`/api/conversation/${conversationId}`);
      setMessages(data.messages);
      setLanguage(data.language || "en");
      setCreatedAt(data.createdAt);
      if (data.completed) {
        setCompleted(true);
        setAssessment(data.assessment);
        setShowDiagnoses(true);
      } else {
        textAreaRef.current?.focus();
      }

      const lastMessage = data.messages[data.messages.length - 1];
      if (lastMessage?.role === "user") {
        // optimistic UI -> on page load, and the last message is currently from the user,
        // we start streaming automatically.
        streamResponse();
      }
      // if the last message is from the AI, and it is showing a tool, display the tool.
      else if (lastMessage?.role === "assistant") {
        try {
          const blocks = JSON.parse(lastMessage.content);
          if (Array.isArray(blocks)) {
            const toolBlock = blocks.find((b: any) => b.type === "tool_use");
            if (toolBlock) {
              setPendingTool({
                id: toolBlock.id,
                name: toolBlock.name,
                input: toolBlock.input,
              });
            }
          }
        } catch {}
      }
    };
    load();
  }, [conversationId]);

  return (
    <div className="h-screen bg-body flex overflow-hidden">
      <div className="fixed top-6 left-6 z-10">
        <a href="https://kasamd.com" target="_blank" rel="noopener noreferrer">
          <img
            src="/icons/themed/kasamd_green.png"
            alt="KasaMD"
            className="h-8"
          />
        </a>
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto py-4">
            {/* Header */}
            <div className="flex items-center justify-between pt-4 pb-2">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <img
                    src="/icons/themed/logogreen_nobg.png"
                    alt="Boafo"
                    className="h-10"
                  />
                  <div className="font-ddn font-semibold text-3xl text-main mt-[5px]">
                    Boafo Consult
                  </div>
                </div>
                <div className="font-fakt text-gray-500 text-md py-3">
                  {createdAt && formatConsultDate(createdAt)}
                </div>
              </div>
              <div className="flex flex-col items-end self-start">
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="font-fakt text-sm text-gray-600">Findings</span>
                  <button
                    onClick={() => {
                      setShowFindings((prev) => !prev);
                      setShowDiagnoses(false);
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      showFindings ? "bg-slate-800" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        showFindings ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </label>
                <label className={`flex items-center gap-2 ${completed ? "cursor-pointer" : "cursor-not-allowed"}`}>
                  <span className={`font-fakt text-sm ${completed ? "text-gray-600" : "text-gray-300"}`}>Diagnoses</span>
                  <button
                    onClick={() => {
                      if (!completed) return;
                      setShowDiagnoses((prev) => !prev);
                      setShowFindings(false);
                    }}
                    disabled={!completed}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      !completed
                        ? "bg-gray-200 cursor-not-allowed"
                        : showDiagnoses
                          ? "bg-slate-800"
                          : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        showDiagnoses ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </label>
              </div>
              <div className="font-fakt text-xs text-gray-400 tracking-wide uppercase mt-1">
                Demo · For clinician use only
              </div>
              </div>
            </div>
            <div className="font-fakt font-semibold text-main text-base my-8">
              If this is an emergency, call 911 or your local emergency number.
            </div>
            <hr className="mb-4 border-outline" />
            {renderMessages()}
            {streaming && !messages[messages.length - 1]?.content && (
              <TypingIndicator />
            )}
            {pendingTool?.name === "collect_demographics" && (
              <DemographicsForm onSubmit={handleDemographicsSubmit} />
            )}
            {completed && (
              <div className="bg-white rounded-2xl p-8 mt-6 animate-summary-enter">
                <div className="flex items-center gap-3 mb-2">
                  <img
                    src="/icons/themed/logogreen_nobg.png"
                    alt="Boafo"
                    className="h-8"
                  />
                </div>
                <h2 className="font-ddn font-semibold text-3xl mb-1">
                  AI Consult Summary
                </h2>
                <p className="font-fakt text-gray-500 text-sm mb-4">
                  {createdAt && formatSummaryDate(createdAt)}
                </p>
                {assessmentLoading && !assessment && (
                  <LoadingPanel
                    title="Writing Your AI Consult Summary"
                    subtitle="Reviewing the latest medical data..."
                  />
                )}
                {assessment && (
                  <Accordion title="Assessment & Plan">
                    <div className="assessment-markdown">
                      <ReactMarkdown>{assessment}</ReactMarkdown>
                    </div>
                  </Accordion>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input area */}
        {!completed && (
          <div className="shrink-0 bg-body pb-4 max-w-2xl w-full mx-auto">
            <div className="bg-white p-2 rounded-lg shadow-sm border-gray-200">
              <div className="flex justify-between items-center mb-2 px-1">
                {language && language !== "en" && (
                  <span className="font-fakt text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-600">
                    {language === "ak" ? "Twi" : language}
                  </span>
                )}
              </div>
              {error && (
                <div className="font-fakt text-red-600 text-sm px-1 mb-2">{error}</div>
              )}
              <TextArea
                ref={textAreaRef}
                value={message}
                onChange={setMessage}
                onSubmit={handleSend}
                placeholder={language === "ak" ? "Kyerɛ me wo yare ho..." : "Type your message..."}
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || streaming}
                  className={`p-2 rounded-full text-white ${message.trim() && !streaming ? "bg-main" : "bg-gray-300"}`}
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
        )}
      </div>

      {/* Side panels */}
      {showFindings && (
        <div className="w-80 border-l border-gray-200 bg-body shrink-0 overflow-y-auto">
          <FindingsPanel ref={findingsRef} conversationId={conversationId!} />
        </div>
      )}
      {showDiagnoses && (
        <div className="w-80 border-l border-gray-200 bg-body shrink-0 overflow-y-auto">
          <DiagnosisPanel conversationId={conversationId!} />
        </div>
      )}
    </div>
  );
};

export default Conversation;
