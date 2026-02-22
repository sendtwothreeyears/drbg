export type Message = {
  messageid: string;
  conversationId: string;
  content: string;
  role: "user" | "assistant";
  created_at: string;
  original_content: string | null;
  original_language: string | null;
};
