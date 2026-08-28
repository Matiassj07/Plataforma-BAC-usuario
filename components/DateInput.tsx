"use client";

import { useRef } from "react";

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

function toDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function toISO(display: string): string {
  const [d, m, y] = display.split("/");
  if (!d || !m || !y || y.length !== 4) return "";
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function DateInput({ value, onChange, className, placeholder }: DateInputProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={toDisplay(value)}
        placeholder={placeholder ?? "dd/mm/aaaa"}
        onChange={(e) => {
          let v = e.target.value.replace(/[^\d/]/g, "");
          const digits = v.replace(/\//g, "");
          if (digits.length <= 8) {
            let formatted = "";
            for (let i = 0; i < digits.length; i++) {
              if (i === 2 || i === 4) formatted += "/";
              formatted += digits[i];
            }
            v = formatted;
          }
          if (v.length === 10) {
            const iso = toISO(v);
            if (iso && !isNaN(new Date(iso + "T00:00:00").getTime())) {
              onChange(iso);
              return;
            }
          }
          if (v.length < (toDisplay(value) || "").length || v.length < 10) {
            const partial = toISO(v);
            onChange(partial || "");
          }
        }}
        className={className}
      />
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
        tabIndex={-1}
      />
    </div>
  );
}
