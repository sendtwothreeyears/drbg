export type StreamEvent =
  | { text: string }
  | { tool: { id: string; name: string; input: any } }
  | { assessmentLoading: true }
  | { assessmentText: string }
  | { done: true; [key: string]: any }
  | { error: string };
