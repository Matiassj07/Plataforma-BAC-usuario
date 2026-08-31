"use client";

import { Suspense, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { Shield, Mail, Lock, ArrowLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";

function LoginError() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err) setError(err);
  }, [searchParams]);

  if (!error) return null;
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
      {error}
    </div>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setResetSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo-bac.jpg" alt="BAC Legal Advisor" width={220} height={60} className="h-14 w-auto object-contain" priority />
          <p className="text-sm text-bac-gray-text mt-1 flex items-center justify-center gap-1">
            <Shield className="w-4 h-4" />
            Portal de cumplimiento LOPDP
          </p>
        </div>

        {/* Error from URL param (after failed login redirect) */}
        <Suspense>
          <LoginError />
        </Suspense>

        {/* Error from client-side actions (reset password) */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {mode === "login" ? (
          <>
            <form action="/api/auth/login" method="POST" className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Correo electr&oacute;nico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="off"
                    placeholder="usuario@empresa.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-bac-gray-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/40 focus:border-bac-red"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Contrase&ntilde;a
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="********"
                    className="w-full pl-10 pr-4 py-2.5 border border-bac-gray-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/40 focus:border-bac-red"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-bac-red hover:bg-bac-red-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                Iniciar sesión
              </button>
            </form>

            <p className="text-center text-sm text-bac-gray-text">
              <button
                type="button"
                onClick={() => { setMode("reset"); setError(null); setResetSent(false); }}
                className="hover:underline"
              >
                &iquest;Olvidaste tu contrase&ntilde;a?
              </button>
            </p>
          </>
        ) : resetSent ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Revisa tu correo</h2>
            <p className="text-sm text-bac-gray-text">
              Enviamos un enlace de recuperación a <strong>{email}</strong>. Revisa tu bandeja de entrada y sigue las instrucciones.
            </p>
            <button
              type="button"
              onClick={() => { setMode("login"); setResetSent(false); setError(null); }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-bac-red hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleReset} className="space-y-4">
              <p className="text-sm text-bac-gray-text">
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Correo electr&oacute;nico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                    className="w-full pl-10 pr-4 py-2.5 border border-bac-gray-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/40 focus:border-bac-red"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-2.5 bg-bac-red hover:bg-bac-red-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Enviando..." : "Enviar enlace de recuperación"}
              </button>
            </form>

            <p className="text-center text-sm text-bac-gray-text">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); }}
                className="inline-flex items-center gap-1.5 hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al inicio de sesión
              </button>
            </p>
          </>
        )}
      </div>
      <span className="mt-6 text-[11px] text-gray-400/70 select-none tracking-wide">
        Developed by © Kappa-ai.com
      </span>
    </div>
  );
}
