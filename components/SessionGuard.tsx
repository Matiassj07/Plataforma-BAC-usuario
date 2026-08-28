"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const SESSION_KEY = "bac-user-session-uid";

function clearAuthCookies(prefix: string) {
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name.startsWith(prefix)) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
}

export default function SessionGuard() {
  const [collision, setCollision] = useState(false);
  const checking = useRef(false);

  const checkCollision = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const storedUid = sessionStorage.getItem(SESSION_KEY);
      if (!storedUid) return;

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookieOptions: { name: "sb-user" }, isSingleton: false }
      );
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = "/login";
        return;
      }

      if (session.user.id !== storedUid) {
        sessionStorage.removeItem(SESSION_KEY);
        setCollision(true);
      }
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookieOptions: { name: "sb-user" }, isSingleton: false }
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        sessionStorage.setItem(SESSION_KEY, session.user.id);
      }
    });

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        checkCollision();
      }
    }

    function handleFocus() {
      checkCollision();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkCollision]);

  if (!collision) return null;

  function handleReLogin() {
    clearAuthCookies("sb-user");
    window.location.href = "/login";
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-xl bg-white p-8 text-center space-y-4 shadow-2xl">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900">Sesión reemplazada</h2>
        <p className="text-sm text-gray-600">
          Se inició sesión con otra cuenta en otra pestaña del navegador. Esta sesión ya no es válida.
        </p>
        <button
          onClick={handleReLogin}
          className="w-full rounded-lg bg-bac-red py-2.5 text-sm font-semibold text-white hover:bg-bac-red-dark transition-colors"
        >
          Iniciar sesión nuevamente
        </button>
      </div>
    </div>
  );
}
