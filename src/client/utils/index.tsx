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

export { getDisplayText };
