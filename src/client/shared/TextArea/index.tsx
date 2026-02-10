import React, { useRef, useCallback } from "react";

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

const TextArea = ({ value, onChange, placeholder, rows }: TextAreaProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
      onChange(el.value);
    },
    [onChange],
  );

  return (
    <textarea
      ref={ref}
      className="w-full resize-none outline-none px-2 py-1 overflow-hidden"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      {...(rows !== undefined && { rows })}
    />
  );
};

export default TextArea;
