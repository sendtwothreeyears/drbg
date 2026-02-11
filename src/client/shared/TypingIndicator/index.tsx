import { useState, useEffect } from "react";

const THINKING_DELAY_MS = 4000;

const TypingIndicator = () => {
  const [showThinking, setShowThinking] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowThinking(true), THINKING_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-start py-1">
      <div className="px-4 py-3 flex items-center gap-1.5">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
      {showThinking && (
        <span className="px-4 text-sm text-gray-400 font-fakt animate-fade-in">
          thinking...
        </span>
      )}
    </div>
  );
};

export default TypingIndicator;
