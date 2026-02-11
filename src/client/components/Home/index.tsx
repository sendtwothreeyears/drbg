import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TextArea, { TextAreaHandle } from "../../shared/TextArea";
import Spinner from "../../shared/Spinner";
import { sendBotMessage } from "../../services/api";

type GetStartedProps = {
  onStartConversation: (message: string) => void;
  loading: boolean;
};

const GetStarted = ({ onStartConversation, loading }: GetStartedProps) => {
  const [message, setMessage] = useState("");
  const textAreaRef = useRef<TextAreaHandle>(null);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  return (
    <div
      className="
				bg-white
				p-2
				rounded-lg
				shadow-sm
				border-gray-200
			"
    >
      <TextArea
        ref={textAreaRef}
        value={message}
        onChange={setMessage}
        onSubmit={() => onStartConversation(message)}
        placeholder="Describe your symptoms..."
      />
      <div className="flex justify-end">
        {loading ? (
          <Spinner />
        ) : (
          <button
            onClick={() => onStartConversation(message)}
            disabled={!message.trim()}
            className="bg-slate-800 py-2 px-4 rounded-sm text-white text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Get Started
          </button>
        )}
      </div>
    </div>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onStartConversation = async (message: string) => {
    try {
      setLoading(true);
      const { data } = await sendBotMessage(message);
      navigate(`/conversation/${data.conversationId}`);
    } catch (err) {
      console.log("Here is an error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-body">
      <div className="max-w-lg m-auto py-30 flex flex-col">
        <div className="font-gt-super font-medium text-3xl">
          Hi, I'm{" "}
          <span className="relative">
            Dr. Bogan
            <span className="absolute left-[5px] z-[-1] right-0 bottom-0 h-[5px] bg-highlight" />
          </span>
        </div>
        <div className="font-fakt text-gray-600 font-medium text-lg pt-2">
          <div className="py-2">
            Symptom assessment, guided by AI. Through a structured clinical
            interview, we'll help you understand what your symptoms may
            indicate.
          </div>
          <div className="py-2">No account required. No cost.</div>
          <div className="py-2">What symptoms are you experiencing?</div>
        </div>
        {/* Entry point for AI documenter */}
        <GetStarted
          onStartConversation={onStartConversation}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default Home;
