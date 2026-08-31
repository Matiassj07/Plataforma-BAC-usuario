"use client";

import { useRef, useState, useEffect } from "react";
import { Calendar } from "lucide-react";

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function displayToISO(display: string): string {
  const [d, m, y] = display.split("/");
  if (!d || !m || !y || y.length !== 4) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function formatDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) out += "/";
    out += digits[i];
  }
  return out;
}

export function DateInput({ value, onChange, className, placeholder }: DateInputProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [display, setDisplay] = useState(() => isoToDisplay(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDisplay(isoToDisplay(value));
    }
  }, [value, focused]);

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatDigits(e.target.value);
    setDisplay(formatted);

    if (formatted.length === 10) {
      const iso = displayToISO(formatted);
      if (iso && !isNaN(new Date(iso + "T00:00:00").getTime())) {
        onChange(iso);
      }
    } else if (formatted === "") {
      onChange("");
    }
  }

  function handleBlur() {
    setFocused(false);
    if (display.length === 10) {
      const iso = displayToISO(display);
      if (iso && !isNaN(new Date(iso + "T00:00:00").getTime())) {
        onChange(iso);
      } else {
        setDisplay(isoToDisplay(value));
      }
    } else if (display === "") {
      onChange("");
    } else {
      setDisplay(isoToDisplay(value));
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={display}
        placeholder={placeholder ?? "dd/mm/aaaa"}
        onChange={handleTextChange}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        className={className}
      />
      <button
        type="button"
        onClick={() => hiddenRef.current?.showPicker?.()}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        tabIndex={-1}
      >
        <Calendar className="h-4 w-4" />
      </button>
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
