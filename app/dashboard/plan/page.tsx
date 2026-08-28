import { requireCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import PlanImplementacionClient from "@/components/dashboard/PlanImplementacionClient";
import type { PlanImplementacion } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const cu = await requireCurrentUser();
  const supabase = createAdminClient();

  const [{ data: planesData }, { data: ratData }, { data: riesgosData }, { data: carpetasData }] = await Promise.all([
    supabase
      .from("planes_implementacion")
      .select("*")
      .eq("profile_id", cu.profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("rat_versiones")
      .select("actividades_rat(id, nombre_actividad)")
      .eq("profile_id", cu.profile.id)
      .order("version", { ascending: false })
      .limit(1),
    supabase
      .from("matriz_riesgos")
      .select("actividades_riesgo(id, actividad_tratamiento)")
      .eq("profile_id", cu.profile.id)
      .order("version", { ascending: false })
      .limit(1),
    supabase
      .from("carpetas_documentos")
      .select("nombre, documentos_carpeta(id, nombre_archivo)")
      .eq("profile_id", cu.profile.id),
  ]);

  const planes = (planesData ?? []) as PlanImplementacion[];

  const actividadesRat = ((ratData?.[0] as any)?.actividades_rat ?? []).map((a: any, i: number) => ({
    id: a.id as string,
    index: i + 1,
    nombre: (a.nombre_actividad as string) ?? `Actividad ${i + 1}`,
  }));

  const actividadesRiesgo = ((riesgosData?.[0] as any)?.actividades_riesgo ?? []).map((a: any, i: number) => ({
    id: a.id as string,
    index: i + 1,
    nombre: (a.actividad_tratamiento as string) ?? `Riesgo ${i + 1}`,
  }));

  const documentos = ((carpetasData ?? []) as any[]).flatMap((c: any) =>
    ((c.documentos_carpeta ?? []) as any[]).map((d: any) => ({
      id: d.id as string,
      nombre: `${c.nombre}/${d.nombre_archivo}` as string,
    }))
  );

  const canEdit = cu.type === "profile" || cu.effectiveRol !== "cliente";

  return (
    <PlanImplementacionClient
      planes={planes}
      actividadesRat={actividadesRat}
      actividadesRiesgo={actividadesRiesgo}
      documentos={documentos}
      soloLectura={!canEdit}
    />
  );
}
