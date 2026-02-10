import React, { useState } from "react";
import TextArea from "../../shared/TextArea";

type GetStartedProps = {
  onStartConversation: (message: string) => void;
};

const GetStarted = ({ onStartConversation }: GetStartedProps) => {
  const [message, setMessage] = useState("");

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
        value={message}
        onChange={setMessage}
        placeholder="Describe your symptoms..."
      />
      <div className="flex justify-end">
        <button
          onClick={() => onStartConversation(message)}
          className="bg-slate-800 py-2 px-4 rounded-sm text-white"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

const Home = () => {
  const onStartConversation = (message: string) => {
    console.log("here starting a conversation", message);
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
        <div className="font-fakt text-gray-600 font-medium text-md pt-2">
          <div className="py-2">
            Symptom assessment, guided by AI. Through a structured clinical
            interview, we'll help you understand what your symptoms may
            indicate.
          </div>
          <div className="py-2">No account required. No cost.</div>
          <div className="py-2">What symptoms are you experiencing?</div>
        </div>
        {/* Entry point for AI documenter */}
        <GetStarted onStartConversation={onStartConversation} />
      </div>
    </div>
  );
};

export default Home;
