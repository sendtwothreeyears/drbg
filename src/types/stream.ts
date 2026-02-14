export type StreamEvent =
  | { text: string }
  | { tool: { id: string; name: string; input: any } }
  | { done: true; [key: string]: any }
  | { error: string };
