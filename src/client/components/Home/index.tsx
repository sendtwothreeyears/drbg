import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TextArea, { TextAreaHandle } from "../../shared/TextArea";
import Spinner from "../../shared/Spinner";
import { createNewConversation } from "../../services/api";

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
            className="bg-main py-2 px-4 rounded-sm text-white text-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
      const { data } = await createNewConversation(message);
      navigate(`/conversation/${data.conversationId}`);
    } catch (err) {
      console.log("Here is an error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-body">
      <div className="fixed top-6 left-6 z-10">
        <a href="https://kasamd.com" target="_blank" rel="noopener noreferrer">
          <img
            src="/icons/themed/kasamd_green.png"
            alt="KasaMD"
            className="h-8"
          />
        </a>
      </div>
      <div className="max-w-lg m-auto py-40 flex flex-col">
        <div className="mb-2">
          <div className="flex items-center gap-3 mb-2">
            <img
              src="/icons/themed/logogreen_nobg.png"
              alt="Boafo"
              className="h-10"
            />
            <div className="font-ddn font-semibold text-4xl text-main mt-[5px]">
              Hi, I'm{" "}
              <span className="relative">
                Boafo
                <span className="absolute left-[5px] z-[-1] right-0 bottom-0 h-[5px] bg-highlight" />
              </span>
            </div>
          </div>
          <div className="font-fakt text-gray-600 font-medium text-xl pt-2">
            <div className="py-2">
              I'm here to help you understand your symptoms. I'll guide you through a few questions.
            </div>
            <div className="py-2">What symptoms are you experiencing?</div>
          </div>
        </div>
        {/* Entry point for AI documenter */}
        <div className="py-2">
          <GetStarted
            onStartConversation={onStartConversation}
            loading={loading}
          />
          <div className="font-fakt text-gray-400 text-xs text-center mt-2">
            This is a demo. Not a substitute for professional medical advice.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
