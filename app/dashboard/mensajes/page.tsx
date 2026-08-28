import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatearFecha } from "@/lib/utils";
import { MessageSquare, Mail } from "lucide-react";

export default async function MensajesPage() {
  const profile = await requireUser();
  const supabase = createAdminClient();

  const [{ data: notas }, { data: correos }] = await Promise.all([
    supabase
      .from("notas_internas")
      .select("id, contenido, created_at")
      .eq("profile_id", profile.id)
      .eq("visible_cliente", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("historial_correos")
      .select("id, asunto, estado, created_at")
      .eq("destinatario_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const items = [
    ...(notas ?? []).map((n: any) => ({
      id: n.id,
      tipo: "nota" as const,
      titulo: "Nota de BAC",
      contenido: n.contenido,
      fecha: n.created_at,
    })),
    ...(correos ?? []).map((c: any) => ({
      id: c.id,
      tipo: "correo" as const,
      titulo: c.asunto,
      contenido: c.estado === "enviado" ? "Correo enviado" : "Correo pendiente",
      fecha: c.created_at,
    })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mensajes de BAC</h1>
        <p className="text-sm text-bac-gray-text mt-1">
          Comunicaciones y correos de tu consultor BAC
        </p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-bac-gray-border p-12 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Sin mensajes</h3>
          <p className="mt-2 text-sm text-bac-gray-text max-w-md mx-auto">
            Aquí verás las comunicaciones que BAC te envíe.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((msg) => (
            <div key={msg.id} className="bg-white rounded-xl border border-bac-gray-border p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${msg.tipo === "correo" ? "bg-blue-600" : "bg-bac-red"}`}>
                    {msg.tipo === "correo" ? (
                      <Mail className="w-4 h-4 text-white" />
                    ) : (
                      <span className="text-white text-xs font-bold">B</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-gray-900">{msg.titulo}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${msg.tipo === "correo" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                        {msg.tipo === "correo" ? "Correo" : "Nota"}
                      </span>
                    </div>
                    <p className="text-sm text-bac-gray-text mt-1 whitespace-pre-wrap">{msg.contenido}</p>
                  </div>
                </div>
                <span className="text-xs text-bac-gray-text flex-shrink-0 ml-4">
                  {formatearFecha(msg.fecha)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
