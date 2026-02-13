export type StreamEvent =
  | { text: string }
  | { tool: { id: string; name: string; input: any } }
  | { done: true }
  | { error: string };
