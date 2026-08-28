import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, DpdPlan, DpdActividad, DpdActa, EtapaFlujoEnum } from "@/lib/types";

const SCORE_POR_ETAPA: Record<EtapaFlujoEnum, number> = {
  sin_iniciar: 0,
  onboarding: 0,
  docs_completos: 30,
  rat_completado: 60,
  riesgos_completados: 90,
  plan_implementacion: 95,
  dpd_completado: 99,
  auditado: 100,
};

export interface UserDashboardData {
  profile: Profile;
  score: number | null;
  scoreHistorial: { score: number; mes: string }[];
  ratCount: number;
  matrizCount: number;
  docsSubidos: number;
  personalCount: number;
  brechasAbiertas: number;
  dpd: {
    plan: DpdPlan | null;
    actividades: DpdActividad[];
    actas: DpdActa[];
  };
  actividadesCompletadas: number;
  actividadesTotal: number;
}

function calcularScore(etapa: EtapaFlujoEnum | null): number {
  if (!etapa || etapa === "onboarding") return SCORE_POR_ETAPA.sin_iniciar;
  return SCORE_POR_ETAPA[etapa] ?? 0;
}

export async function getUserDashboardData(profileId: string): Promise<UserDashboardData> {
  const supabase = createAdminClient();

  const [
    { data: profile },
    { data: scoreHist },
    { count: ratCount },
    { count: matrizCount },
    { data: docs },
    { count: personalCount },
    { data: brechas },
    { data: plan },
    { data: flujoEstado },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", profileId).single(),
    supabase
      .from("score_historial")
      .select("score, mes")
      .eq("profile_id", profileId)
      .order("mes", { ascending: true }),
    supabase
      .from("rat_versiones")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profileId),
    supabase
      .from("matriz_riesgos")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profileId),
    supabase
      .from("documentos_generales")
      .select("tipo_documento")
      .eq("profile_id", profileId)
      .neq("tipo_documento", "rat_actividad"),
    supabase
      .from("personal")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profileId),
    supabase
      .from("brechas_seguridad")
      .select("id")
      .eq("profile_id", profileId)
      .eq("estado", "abierta"),
    supabase
      .from("dpd_planes")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("flujo_estados")
      .select("etapa")
      .eq("profile_id", profileId)
      .maybeSingle(),
  ]);

  let actividadesList: DpdActividad[] = [];
  let actasList: DpdActa[] = [];

  if (plan) {
    const [{ data: actData }, { data: actasData }] = await Promise.all([
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
    ]);
    actividadesList = (actData ?? []) as DpdActividad[];
    actasList = (actasData ?? []) as DpdActa[];
  }

  const historial = (scoreHist ?? []) as { score: number; mes: string }[];

  const actividadesCompletadas = actividadesList.filter((a) => a.completada).length;

  const rCount = ratCount ?? 0;
  const mCount = matrizCount ?? 0;
  const dCount = docs?.length ?? 0;
  const pCount = personalCount ?? 0;
  const bCount = brechas?.length ?? 0;
  const actTotal = actividadesList.length;

  const etapaActual = (flujoEstado?.etapa as EtapaFlujoEnum) ?? null;
  const score = calcularScore(etapaActual);

  return {
    profile: profile as Profile,
    score,
    scoreHistorial: historial,
    ratCount: rCount,
    matrizCount: mCount,
    docsSubidos: dCount,
    personalCount: pCount,
    brechasAbiertas: bCount,
    dpd: {
      plan: (plan as DpdPlan) ?? null,
      actividades: actividadesList,
      actas: actasList,
    },
    actividadesCompletadas,
    actividadesTotal: actTotal,
  };
}
