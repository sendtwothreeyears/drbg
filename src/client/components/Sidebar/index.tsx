import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAllConversations } from "../../services/api";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<any[]>([]);
  const [visible, setVisible] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      getAllConversations().then(({ data }) => {
        setConversations(data.conversations);
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true));
      });
    } else {
      setAnimateIn(false);
    }
  }, [isOpen]);

  const handleTransitionEnd = () => {
    if (!isOpen) setVisible(false);
  };

  if (!visible && !isOpen) return null;

  return (
    <div className="fixed inset-0 z-40" onTransitionEnd={handleTransitionEnd}>
      <div
        className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-200 ${animateIn ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`absolute left-0 top-0 h-full w-72 bg-white shadow-lg flex flex-col transition-transform duration-200 ease-out ${animateIn ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-fakt font-semibold text-lg">Conversations</span>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-xl"
          >
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <button
              key={c.conversationid}
              onClick={() => {
                navigate(`/conversation/${c.conversationid}`);
                onClose();
              }}
              className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b border-gray-100"
            >
              <div className="font-fakt text-md truncate">
                {c.title || "Untitled"}
              </div>
              <div className="font-fakt text-xs text-gray-400 mt-1">
                {new Date(c.created_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
