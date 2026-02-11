export const startStream = (
  conversationId: string,
  onText: (text: string) => void,
  onDone: () => void,
) => {
  const eventSource = new EventSource(
    `/api/conversation/${conversationId}/stream`,
  );

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.text) {
      onText(data.text);
    } else if (data.done) {
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
