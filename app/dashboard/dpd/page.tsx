import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import DpdClient from "@/components/dashboard/DpdClient";
import type { DpdPlan, DpdActividad, DpdActa, DpdInformeBrecha } from "@/lib/types";

export default async function DpdPage() {
  const cu = await requireCurrentUser();
  if (cu.effectiveRol === "cliente" || cu.effectiveRol === "asistente") {
    redirect("/dashboard");
  }
  const profile = cu.profile;
  const supabase = createAdminClient();

  const { data: planData } = await supabase
    .from("dpd_planes")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan = planData as DpdPlan | null;

  let actividades: DpdActividad[] = [];
  let actas: DpdActa[] = [];
  let informesBrechas: DpdInformeBrecha[] = [];

  if (plan) {
    const [{ data: actData }, { data: actasData }, { data: brechasData }] = await Promise.all([
      supabase
        .from("dpd_actividades")
        .select("*")
        .eq("plan_id", plan.id)
        .order("mes", { ascending: true }),
      supabase
        .from("dpd_actas")
        .select("*")
        .eq("plan_id", plan.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("dpd_informes_brechas")
        .select("*")
        .eq("plan_id", plan.id)
        .order("anio", { ascending: false })
        .order("mes", { ascending: false }),
    ]);
    actividades = (actData ?? []) as DpdActividad[];
    actas = (actasData ?? []) as DpdActa[];
    informesBrechas = (brechasData ?? []) as DpdInformeBrecha[];
  }

  const { data: brechasSeguridad } = await supabase
    .from("brechas_seguridad")
    .select("id, tipo_incidente, descripcion, fecha_deteccion, estado, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  const hace5Dias = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const brechasFiltradas = (brechasSeguridad ?? []).filter((b: any) => {
    if (b.estado === "cerrada" && b.created_at < hace5Dias) {
      supabase.from("brechas_seguridad").delete().eq("id", b.id).then(() => {});
      return false;
    }
    return true;
  });

  return <DpdClient plan={plan} actividades={actividades} actas={actas} informesBrechas={informesBrechas} brechasSeguridad={brechasFiltradas} soloLectura={false} />;
}
