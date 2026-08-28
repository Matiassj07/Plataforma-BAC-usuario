import { requireCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import RiesgosClient from "@/components/dashboard/RiesgosClient";
import type { MatrizVersion } from "@/lib/types";

export default async function RiesgosPage() {
  const cu = await requireCurrentUser();
  const supabase = createAdminClient();

  const [{ data }, { data: ratData }, { data: config }, { data: planesData }] = await Promise.all([
    supabase
      .from("matriz_riesgos")
      .select("id, version, created_at, actividades_riesgo(*)")
      .eq("profile_id", cu.profile.id)
      .order("version", { ascending: false })
      .limit(20),
    supabase
      .from("rat_versiones")
      .select("actividades_rat(nombre_actividad, base_licitud, articulo_lopdp, activo_informacion, medidas_seguridad, perfiles_automatizados)")
      .eq("profile_id", cu.profile.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("bac_config").select("pro_global_activo").maybeSingle(),
    supabase
      .from("planes_implementacion")
      .select("id, actividad_origen_id, titulo")
      .eq("profile_id", cu.profile.id)
      .eq("tipo", "riesgos"),
  ]);

  const matrices = ((data ?? []) as any[]).map((m: any) => ({
    ...m,
    actividades_riesgo: ((m.actividades_riesgo ?? []) as any[])
      .sort((a: any, b: any) => (a.created_at ?? "").localeCompare(b.created_at ?? "")),
  })) as MatrizVersion[];
  const ratActividades = ratData?.actividades_rat ?? [];
  const canEdit = cu.type === "profile" || cu.effectiveRol !== "cliente";
  const proEfectivo = !!(cu.profile.pro_aprobado_por_admin && config?.pro_global_activo);

  const allRiesgoActIds = matrices.flatMap((m) =>
    (m.actividades_riesgo ?? []).map((a: any) => a.id)
  );
  const { data: cambiosRiesgoData } = allRiesgoActIds.length > 0
    ? await supabase
        .from("riesgo_cambios_campo")
        .select("actividad_riesgo_id, campo, valor_anterior, valor_nuevo, version_cambio, created_at")
        .in("actividad_riesgo_id", allRiesgoActIds)
        .order("created_at", { ascending: true })
    : { data: [] as any[] };

  return (
    <RiesgosClient
      matrices={matrices}
      nombreEmpresa={cu.profile.nombre_empresa ?? ""}
      ratActividades={ratActividades}
      soloLectura={!canEdit}
      proEfectivo={proEfectivo}
      cambiosCampoRiesgo={(cambiosRiesgoData ?? []) as any[]}
      planes={(planesData ?? []) as { id: string; actividad_origen_id: string | null; titulo: string }[]}
    />
  );
}
