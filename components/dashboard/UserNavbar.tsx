"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { NotificacionesBell } from "./NotificacionesBell";

interface UserNavbarProps {
  nombreEmpresa: string;
  iniciales: string;
  isPersonal?: boolean;
  empresaPadre?: string;
  notifCount?: number;
}

export default function UserNavbar({ nombreEmpresa, iniciales, isPersonal, empresaPadre, notifCount = 0 }: UserNavbarProps) {
  const initialUserId = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      initialUserId.current = data.user?.id ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (initialUserId.current && session?.user?.id && session.user.id !== initialUserId.current) {
        window.location.reload();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    sessionStorage.removeItem("bac-user-session-uid");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 h-16 bg-white border-b border-bac-gray-border z-30",
        "flex items-center justify-between px-6"
      )}
    >
      <Link href="/dashboard" className="flex items-center gap-2">
        <Image src="/logo-bac.jpg" alt="BAC Legal Advisor" width={160} height={44} className="h-9 w-auto object-contain" priority />
      </Link>

      <div className="flex items-center gap-3">
        <NotificacionesBell initialCount={notifCount} />
        <div className="text-right">
          <span className="text-sm text-bac-gray-text block">{nombreEmpresa}</span>
          {isPersonal && empresaPadre && (
            <span className="text-[10px] text-bac-gray-text/70">{empresaPadre}</span>
          )}
        </div>
        <div className="w-8 h-8 bg-bac-red rounded-full text-white text-xs font-bold flex items-center justify-center">
          {iniciales}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-bac-gray-text hover:text-bac-red border border-bac-gray-border rounded-lg hover:bg-red-50 transition"
          title="Cerrar sesión"
        >
          <LogOut className="w-3.5 h-3.5" />
          Salir
        </button>
      </div>
    </nav>
  );
}
