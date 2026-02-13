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
}

export interface TextAreaHandle {
  focus: () => void;
}

const TextArea = forwardRef<TextAreaHandle, TextAreaProps>(
  ({ value, onChange, onSubmit, placeholder, rows }, forwardedRef) => {
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
        className="w-full resize-none outline-none px-2 py-1 text-lg overflow-hidden"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        {...(rows !== undefined && { rows })}
      />
    );
  },
);

export default TextArea;
