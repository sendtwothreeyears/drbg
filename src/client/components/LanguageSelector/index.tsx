interface LanguageSelectorProps {
  language: string;
  onChange: (lang: string) => void;
}

const LanguageSelector = ({ language, onChange }: LanguageSelectorProps) => {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => onChange("en")}
        className={`font-fakt text-sm px-3 py-1 rounded-full transition-colors ${
          language === "en"
            ? "bg-main text-white"
            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        }`}
      >
        English
      </button>
      <button
        onClick={() => onChange("ak")}
        className={`font-fakt text-sm px-3 py-1 rounded-full transition-colors ${
          language === "ak"
            ? "bg-main text-white"
            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        }`}
      >
        Twi
      </button>
    </div>
  );
};

export default LanguageSelector;
