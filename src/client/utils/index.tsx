import i18n from "../i18n/config";

const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  ak: "en-GH",
};

const getLocale = () => LOCALE_MAP[i18n.language] || "en-US";

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

  const locale = getLocale();

  let day: string;
  if (date.toDateString() === now.toDateString()) {
    day = i18n.t("conversation.today");
  } else if (date.toDateString() === yesterday.toDateString()) {
    day = i18n.t("conversation.yesterday");
  } else {
    day = date.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });
  }

  const time = date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", hour12: true });
  return `${i18n.t("conversation.consultStarted")} ${day}, ${time}`;
};

const formatSummaryDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  const locale = getLocale();
  const month = date.toLocaleDateString(locale, { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  return `${month} ${day}, ${year}, ${time}`;
};

export { getDisplayText, formatConsultDate, formatSummaryDate };
