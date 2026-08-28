import { createAdminClient } from "@/lib/supabase/admin";
import type { EtapaFlujoEnum } from "@/lib/types";

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

export type PrioridadPendiente = "urgente" | "alto" | "medio" | "info";

export interface Pendiente {
  tipo: string;
  titulo: string;
  descripcion: string;
  prioridad: PrioridadPendiente;
  href: string;
}

const PRIORIDAD_ORDEN: Record<PrioridadPendiente, number> = {
  urgente: 0,
  alto: 1,
  medio: 2,
  info: 3,
};

export interface PendientesResult {
  pendientes: Pendiente[];
  score: number | null;
}

export async function getPendientesUsuario(profileId: string): Promise<PendientesResult> {
  const supabase = createAdminClient();
  const pendientes: Pendiente[] = [];

  const [
    { data: brechasAbiertas },
    { data: profile },
    { count: ratCount },
    { count: matrizCount },
    { count: personalCount },
    { data: flujoEstado },
    { data: planData },
  ] = await Promise.all([
    supabase
      .from("brechas_seguridad")
      .select("id")
      .eq("profile_id", profileId)
      .eq("estado", "abierta"),
    supabase
      .from("profiles")
      .select("onboarding_completado")
      .eq("id", profileId)
      .single(),
    supabase
      .from("rat_versiones")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profileId),
    supabase
      .from("matriz_riesgos")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profileId),
    supabase
      .from("personal")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profileId),
    supabase
      .from("flujo_estados")
      .select("etapa")
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase
      .from("dpd_planes")
      .select("id")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let actasPendientes: any[] = [];
  let actividadesPendientes: any[] = [];

  if (planData) {
    const [{ data: actasData }, { data: actividadesData }] = await Promise.all([
      supabase
        .from("dpd_actas")
        .select("id, numero_acta")
        .eq("plan_id", planData.id)
        .eq("estado", "pendiente_firma"),
      supabase
        .from("dpd_actividades")
        .select("id")
        .eq("plan_id", planData.id)
        .eq("completada", false)
        .lte("mes", new Date().getMonth() + 1),
    ]);
    actasPendientes = actasData ?? [];
    actividadesPendientes = actividadesData ?? [];
  }

  if (actasPendientes && actasPendientes.length > 0) {
    pendientes.push({
      tipo: "acta",
      titulo: "Firmar acta DPD",
      descripcion: `${actasPendientes.length} acta(s) pendiente(s) de firma`,
      prioridad: "urgente",
      href: "/dashboard/dpd",
    });
  }

  if (brechasAbiertas && brechasAbiertas.length > 0) {
    pendientes.push({
      tipo: "brecha",
      titulo: "Brechas abiertas",
      descripcion: `${brechasAbiertas.length} brecha(s) sin resolver`,
      prioridad: "urgente",
      href: "/dashboard/dpd",
    });
  }

  if (profile && !profile.onboarding_completado) {
    pendientes.push({
      tipo: "onboarding",
      titulo: "Completar onboarding",
      descripcion: "Completa los datos de tu empresa",
      prioridad: "alto",
      href: "/dashboard/onboarding",
    });
  }

  if ((ratCount ?? 0) === 0) {
    pendientes.push({
      tipo: "rat",
      titulo: "Crear RAT",
      descripcion: "Registra tus actividades de tratamiento",
      prioridad: "alto",
      href: "/dashboard/rat",
    });
  }

  if ((matrizCount ?? 0) === 0) {
    pendientes.push({
      tipo: "matriz",
      titulo: "Crear Matriz de Riesgos",
      descripcion: "Evalúa los riesgos de tratamiento",
      prioridad: "alto",
      href: "/dashboard/riesgos",
    });
  }


  if (actividadesPendientes && actividadesPendientes.length > 0) {
    pendientes.push({
      tipo: "dpd_actividad",
      titulo: "Actividades DPD pendientes",
      descripcion: `${actividadesPendientes.length} actividad(es) por completar`,
      prioridad: "medio",
      href: "/dashboard/dpd",
    });
  }

  if ((personalCount ?? 0) === 0) {
    pendientes.push({
      tipo: "personal",
      titulo: "Registrar personal",
      descripcion: "Agrega los empleados de tu empresa",
      prioridad: "medio",
      href: "/dashboard/personal",
    });
  }

  const etapaActual = (flujoEstado?.etapa as EtapaFlujoEnum) ?? null;
  const scoreActual = etapaActual ? (SCORE_POR_ETAPA[etapaActual] ?? 0) : 0;
  if (scoreActual < 40) {
    pendientes.push({
      tipo: "score",
      titulo: "Score bajo",
      descripcion: "Tu cumplimiento está por debajo del 40%",
      prioridad: "info",
      href: "/dashboard",
    });
  }

  pendientes.sort((a, b) => PRIORIDAD_ORDEN[a.prioridad] - PRIORIDAD_ORDEN[b.prioridad]);
  return { pendientes, score: scoreActual };
}
