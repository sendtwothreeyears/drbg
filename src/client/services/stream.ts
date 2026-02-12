export type ToolUseEvent = {
  id: string;
  name: string;
  input: any;
};

export const startStream = (
  conversationId: string,
  onText: (text: string) => void,
  onToolUse: (tool: ToolUseEvent) => void,
  onDone: () => void,
) => {
  const eventSource = new EventSource(
    `/api/conversation/${conversationId}/stream`,
  );

  eventSource.onmessage = (event) => {
    console.log("data", event);

    const data = JSON.parse(event.data);

    // stream is ongoing - add chunks to messages array, update UI
    if (data.text) {
      onText(data.text);
    }
    // If Claude returns a tool - stop the stream and use the tool
    else if (data.tool) {
      if (onToolUse) onToolUse(data.tool);
    }
    // Stream ends
    else if (data.done) {
      eventSource.close();
      onDone();
    } else if (data.error) {
      eventSource.close();
      onDone();
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    onDone();
  };

  return eventSource;
};
