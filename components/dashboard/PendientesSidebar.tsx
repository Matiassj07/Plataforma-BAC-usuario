"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { scoreColorClasses } from "@/lib/utils";
import type { Pendiente } from "@/lib/dashboard/pendientes";

interface PendientesSidebarProps {
  pendientes: Pendiente[];
  score: number | null;
}

const prioridadStyles: Record<
  string,
  { border: string; bg: string; badge: string }
> = {
  urgente: {
    border: "border-red-500",
    bg: "bg-red-50",
    badge: "bg-red-100 text-red-700",
  },
  alto: {
    border: "border-amber-500",
    bg: "bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
  },
  medio: {
    border: "border-blue-500",
    bg: "bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
  },
  info: {
    border: "border-gray-400",
    bg: "bg-gray-50",
    badge: "bg-gray-100 text-gray-600",
  },
};

export default function PendientesSidebar({
  pendientes,
  score,
}: PendientesSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const scoreColors = scoreColorClasses(score);
  const displayScore = score ?? 0;

  if (collapsed) {
    return (
      <aside className="fixed right-0 top-16 bottom-0 w-12 bg-white border-l border-bac-gray-border z-20 flex flex-col items-center pt-3">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1 rounded hover:bg-bac-gray-alt transition-colors"
          aria-label="Expandir pendientes"
        >
          <ChevronLeft className="w-4 h-4 text-bac-gray-text" />
        </button>
        {pendientes.length > 0 && (
          <span className="mt-2 w-6 h-6 bg-bac-red text-white text-xs font-bold rounded-full flex items-center justify-center">
            {pendientes.length}
          </span>
        )}
      </aside>
    );
  }

  return (
    <aside className="fixed right-0 top-16 bottom-0 w-72 bg-white border-l border-bac-gray-border overflow-y-auto z-20 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-bac-gray-border">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">Pendientes</h2>
          {pendientes.length > 0 && (
            <span className="w-5 h-5 bg-bac-red text-white text-xs font-bold rounded-full flex items-center justify-center">
              {pendientes.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-bac-gray-alt transition-colors"
          aria-label="Colapsar pendientes"
        >
          <ChevronRight className="w-4 h-4 text-bac-gray-text" />
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {pendientes.length === 0 ? (
          <p className="text-xs text-bac-gray-text text-center py-4">
            No tienes pendientes
          </p>
        ) : (
          pendientes.map((p, i) => {
            const styles = prioridadStyles[p.prioridad] ?? prioridadStyles.info;
            return (
              <Link
                key={`${p.tipo}-${i}`}
                href={p.href}
                className={cn(
                  "block border-l-[3px] rounded-r-lg p-3 transition-opacity hover:opacity-80",
                  styles.border,
                  styles.bg
                )}
              >
                <p className="font-medium text-sm">{p.titulo}</p>
                <p className="text-xs text-bac-gray-text mt-0.5">
                  {p.descripcion}
                </p>
                <span
                  className={cn(
                    "inline-block mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize",
                    styles.badge
                  )}
                >
                  {p.prioridad}
                </span>
              </Link>
            );
          })
        )}
      </div>

      {/* Score section */}
      <div className="border-t border-bac-gray-border p-4">
        <p className="text-xs text-bac-gray-text mb-1">Score LOPDP</p>
        <p className={cn("text-3xl font-bold", scoreColors.text)}>
          {displayScore}
        </p>
        <p className="text-xs text-bac-gray-text mt-0.5">Cumplimiento LOPDP</p>
        <div className="mt-2 h-1.5 rounded-full bg-bac-gray-alt overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", scoreColors.label)}
            style={{ width: `${Math.min(displayScore, 100)}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
