import { requireCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import RatClient from "@/components/dashboard/RatClient";
import type { RatVersion, ActividadRat } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RatPage() {
  const cu = await requireCurrentUser();
  const supabase = createAdminClient();

  const [{ data }, { data: carpetasEjemploData }, { data: docsRat }, { data: carpetasData }, { data: planesData }] = await Promise.all([
    supabase
      .from("rat_versiones")
      .select("id, version, created_at, datos_responsable, datos_dpd, actividades_rat(*)")
      .eq("profile_id", cu.profile.id)
      .order("version", { ascending: false })
      .limit(20),
    supabase.rpc("select_carpetas_ejemplo"),
    supabase
      .from("documentos_carpeta")
      .select("id, nombre_archivo, url_storage, actividad_rat_id, version, doc_original_id, carpetas_documentos!inner(profile_id)")
      .eq("carpetas_documentos.profile_id", cu.profile.id)
      .not("actividad_rat_id", "is", null),
    supabase
      .from("carpetas_documentos")
      .select("id, nombre, documentos_carpeta(id, nombre_archivo, url_storage)")
      .eq("profile_id", cu.profile.id)
      .order("nombre"),
    supabase
      .from("planes_implementacion")
      .select("id, actividad_origen_id, titulo")
      .eq("profile_id", cu.profile.id)
      .eq("tipo", "rat"),
  ]);

  const versiones: RatVersion[] = (data ?? []).map((v: any) => ({
    ...v,
    actividades_rat: ((v.actividades_rat ?? []) as any[])
      .sort((a: any, b: any) => (a.created_at ?? "").localeCompare(b.created_at ?? "")),
  }));

  const allActividadIds = versiones.flatMap((v: any) =>
    ((v.actividades_rat ?? []) as any[]).map((a: any) => a.id)
  );
  const { data: cambiosCampoData } = allActividadIds.length > 0
    ? await supabase
        .from("rat_cambios_campo")
        .select("actividad_rat_id, campo, valor_anterior, valor_nuevo, version_cambio, created_at")
        .in("actividad_rat_id", allActividadIds)
        .order("created_at", { ascending: true })
    : { data: [] as any[] };

  const canEdit = cu.type === "profile" || cu.effectiveRol !== "cliente";

  const { data: config } = await supabase.from("bac_config").select("pro_global_activo").maybeSingle();
  const proEfectivo = !!(cu.profile.pro_aprobado_por_admin && config?.pro_global_activo);

  const carpetasEjemplo = ((carpetasEjemploData ?? []) as any[]).map((c: any) => ({
    id: c.id as string,
    nombre: c.nombre as string,
  }));

  const docsActividades = ((docsRat ?? []) as any[]).map((d: any) => ({
    id: d.id as string,
    nombre_archivo: d.nombre_archivo as string,
    url_storage: d.url_storage as string,
    actividad_rat_id: d.actividad_rat_id as string,
    version: (d.version as number) ?? 1,
    doc_original_id: (d.doc_original_id as string | null) ?? null,
  }));

  const carpetas = ((carpetasData ?? []) as any[]).map((c: any) => ({
    id: c.id as string,
    nombre: c.nombre as string,
    documentos: ((c.documentos_carpeta ?? []) as any[]).map((d: any) => ({
      id: d.id as string,
      nombre_archivo: d.nombre_archivo as string,
      url_storage: d.url_storage as string,
    })),
  }));

  return (
    <RatClient
      versiones={versiones}
      nombreEmpresa={cu.profile.nombre_empresa ?? ""}
      soloLectura={!canEdit}
      proEfectivo={proEfectivo}
      carpetasEjemplo={carpetasEjemplo}
      carpetas={carpetas}
      docsActividades={docsActividades}
      cambiosCampoRat={(cambiosCampoData ?? []) as { actividad_rat_id: string; campo: string; valor_anterior: string | null; valor_nuevo: string | null; version_cambio: number; created_at: string; }[]}
      planes={(planesData ?? []) as { id: string; actividad_origen_id: string | null; titulo: string }[]}
    />
  );
}
