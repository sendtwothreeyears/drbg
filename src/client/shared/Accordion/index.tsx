import { useState } from "react";

interface AccordionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const Accordion = ({ title, subtitle, defaultOpen = true, children }: AccordionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center justify-between w-full text-left"
      >
        <div>
          <h3 className="font-ddn font-semibold text-xl text-blue-main">
            {title}
          </h3>
          {subtitle && (
            <p className="font-fakt text-gray-500 text-sm">{subtitle}</p>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-5 h-5 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
};

export default Accordion;
