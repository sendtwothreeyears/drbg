export type Conversation = {
  conversationid: string;
  title: string | null;
  completed: boolean;
  assessment: string | null;
  assessment_sources: { source: string; section: string; similarity: number }[] | null;
  created_at: string;
  authorid: string | null;
  language: string;
};
