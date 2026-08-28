"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { Shield, Lock, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo-bac.jpg" alt="BAC Legal Advisor" width={220} height={60} className="h-14 w-auto object-contain" priority />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Nueva contraseña</h1>
            <p className="text-sm text-bac-gray-text mt-1 flex items-center justify-center gap-1">
              <Shield className="w-4 h-4" />
              Portal de cumplimiento LOPDP
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {done ? (
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Contraseña actualizada</h2>
            <p className="text-sm text-bac-gray-text">Redirigiendo al dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-bac-gray-text">
              Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.
            </p>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                Nueva contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full pl-10 pr-10 py-2.5 border border-bac-gray-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/40 focus:border-bac-red"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="confirm-password"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full pl-10 pr-4 py-2.5 border border-bac-gray-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/40 focus:border-bac-red"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full py-2.5 bg-bac-red hover:bg-bac-red-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Actualizando..." : "Establecer nueva contraseña"}
            </button>
          </form>
        )}
      </div>
      <span className="mt-6 text-[11px] text-gray-400/70 select-none tracking-wide">
        Developed by © Kappa-ai.com
      </span>
    </div>
  );
}
