export type ToolUseEvent = {
  id: string;
  name: string;
  input: any;
};

export const startStream = (
  conversationId: string,
  onText: (text: string) => void,
  onToolUse: (tool: ToolUseEvent) => void,
  onAssessmentLoading: () => void,
  onDone: (meta?: Record<string, any>) => void,
) => {
  // Server sends raw text via res.write():  "data: {\"text\":\"hi\"}\n\n"
  // EventSource receives that raw text stream
  // Browser parses it: strips "data: " prefix and "\n\n"
  // Browser creates a MessageEvent and appends the parsed data to event.data
  // onmessage fires with that MessageEvent
  const eventSource = new EventSource(
    `/api/conversation/${conversationId}/stream`,
  );

  eventSource.onmessage = (event: MessageEvent) => {
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
    // Assessment generation has started
    else if (data.assessmentLoading) {
      onAssessmentLoading();
    }
    // Stream ends
    else if (data.done) {
      eventSource.close();
      const { done, ...meta } = data;
      onDone(meta);
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
