"use client";

import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  widthClassName = "max-w-lg",
  children,
}: {
  title: string;
  onClose: () => void;
  widthClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`w-full ${widthClassName} rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-bac-gray-border px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-bac-gray-alt">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
