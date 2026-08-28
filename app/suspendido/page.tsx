"use client";

import { createClient } from "@/lib/supabase/client";
import { ShieldX } from "lucide-react";

export default function SuspendidoPage() {
  async function handleSignOut() {
    sessionStorage.removeItem("bac-user-session-uid");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <ShieldX className="w-8 h-8 text-bac-red" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">
            Cuenta suspendida
          </h1>
          <p className="text-bac-gray-text text-sm">
            Tu cuenta ha sido suspendida. Contacta a BAC para m&aacute;s
            informaci&oacute;n.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full py-2.5 bg-bac-red hover:bg-bac-red-dark text-white font-semibold rounded-lg transition-colors"
        >
          Cerrar sesi&oacute;n
        </button>
      </div>
    </div>
  );
}
