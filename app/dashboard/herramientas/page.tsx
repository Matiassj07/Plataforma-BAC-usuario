import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface Herramienta {
  id: string;
  titulo: string;
  subtitulo: string | null;
  descripcion: string | null;
  url: string;
  tipo: "video" | "enlace";
}

async function getHerramientasActivas(): Promise<Herramienta[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("herramientas")
      .select("id, titulo, subtitulo, descripcion, url, tipo")
      .eq("activo", true)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as Herramienta[];
  } catch {
    return [];
  }
}

export default async function HerramientasPage() {
  const herramientas = await getHerramientasActivas();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Herramientas</h1>
        <p className="text-sm text-bac-gray-text">
          Videos tutoriales, guías y recursos útiles para tu gestión de cumplimiento.
        </p>
      </div>

      {herramientas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-bac-gray-border py-16 text-center">
          <p className="text-sm font-medium text-gray-900">No hay herramientas disponibles</p>
          <p className="mt-1 text-xs text-bac-gray-text">
            Tu administrador aún no ha agregado recursos.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {herramientas.map((h) => (
            <a
              key={h.id}
              href={h.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-4 rounded-xl border border-bac-gray-border bg-white p-5 transition-colors hover:border-bac-red hover:shadow-sm"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-bac-gray-alt group-hover:bg-red-50 transition-colors">
                {h.tipo === "video" ? (
                  <svg className="h-5 w-5 text-bac-red" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-bac-red transition-colors">
                    {h.titulo}
                  </h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    h.tipo === "video"
                      ? "bg-red-50 text-bac-red"
                      : "bg-blue-50 text-blue-600"
                  }`}>
                    {h.tipo === "video" ? "Video" : "Enlace"}
                  </span>
                </div>
                {h.subtitulo && (
                  <p className="mt-0.5 text-xs font-medium text-bac-gray-text">{h.subtitulo}</p>
                )}
                {h.descripcion && (
                  <p className="mt-2 text-xs text-gray-600 leading-relaxed line-clamp-3">{h.descripcion}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
