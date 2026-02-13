const getDisplayText = (content: string): string => {
  try {
    const blocks = JSON.parse(content);
    if (!Array.isArray(blocks)) return content;
    const textBlock = blocks.find((b: any) => b.type === "text");
    if (textBlock) return textBlock.text;
    return "";
  } catch {
    return content;
  }
};

const formatConsultDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  let day: string;
  if (date.toDateString() === now.toDateString()) {
    day = "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    day = "Yesterday";
  } else {
    day = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }

  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `Consult started: ${day}, ${time}`;
};

export { getDisplayText, formatConsultDate };
