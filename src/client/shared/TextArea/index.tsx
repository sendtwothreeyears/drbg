import React, {
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export interface TextAreaHandle {
  focus: () => void;
}

const TextArea = forwardRef<TextAreaHandle, TextAreaProps>(
  ({ value, onChange, onSubmit, placeholder, rows, disabled }, forwardedRef) => {
    const ref = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(forwardedRef, () => ({
      focus: () => ref.current?.focus(),
    }));

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit?.();
        }
      },
      [onSubmit],
    );

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
        className={`w-full resize-none outline-none px-2 py-1 text-lg overflow-hidden ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        {...(rows !== undefined && { rows })}
      />
    );
  },
);

export default TextArea;
