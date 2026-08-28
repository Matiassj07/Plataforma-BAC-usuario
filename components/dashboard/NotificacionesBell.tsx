"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { getNotificaciones, marcarNotificacionLeida, marcarTodasLeidas } from "@/lib/dashboard/notificaciones-actions";

interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  modulo: string | null;
  leida: boolean;
  created_at: string;
}

function tiempoRelativo(fecha: string): string {
  const diff = Date.now() - new Date(fecha).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const dias = Math.floor(hrs / 24);
  return `${dias}d`;
}

export function NotificacionesBell({ initialCount = 0 }: { initialCount?: number }) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notificacion[]>([]);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const data = await getNotificaciones(10);
      setNotifs(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    await marcarNotificacionLeida(id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, leida: true } : n));
    setCount((c) => Math.max(0, c - 1));
  }

  async function handleMarkAll() {
    await marcarTodasLeidas();
    setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })));
    setCount(0);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-bac-gray-alt transition"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-bac-red px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-bac-gray-border bg-white shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-bac-gray-border">
            <span className="text-sm font-semibold text-gray-900">Notificaciones</span>
            {count > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs text-bac-red hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-xs text-bac-gray-text">Cargando...</p>
            ) : notifs.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-bac-gray-text">Sin notificaciones</p>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.leida && handleMarkRead(n.id)}
                  className={`px-4 py-2.5 border-b border-bac-gray-border last:border-0 cursor-pointer hover:bg-bac-gray-alt transition ${!n.leida ? "bg-blue-50/50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm ${!n.leida ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                        {n.titulo}
                      </p>
                      {n.descripcion && (
                        <p className="text-xs text-bac-gray-text mt-0.5">{n.descripcion}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-bac-gray-text whitespace-nowrap">{tiempoRelativo(n.created_at)}</span>
                  </div>
                  {n.modulo && (
                    <span className="inline-block mt-1 text-[10px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {n.modulo}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
