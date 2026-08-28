import { requireUser } from "@/lib/auth";
import OnboardingClient from "@/components/dashboard/OnboardingClient";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function OnboardingPage() {
  const profile = await requireUser();
  const supabase = createAdminClient();
  const { data: sectoresCustom } = await supabase
    .from("sectores_custom")
    .select("id, nombre")
    .order("nombre");

  return (
    <OnboardingClient
      initialProfile={{
        nombre_empresa: profile.nombre_empresa ?? "",
        ruc: profile.ruc ?? "",
        direccion: profile.direccion ?? "",
        telefono: profile.telefono ?? "",
        web: profile.web ?? "",
        nicho: profile.nicho ?? "otros",
        tamano_empresa: profile.tamano_empresa,
        tiene_dpd: profile.tiene_dpd,
        trata_datos_especiales: profile.trata_datos_especiales ?? [],
        dpd_tipo: profile.dpd_tipo ?? null,
        onboarding_paso: profile.onboarding_paso ?? 1,
      }}
      sectoresCustom={(sectoresCustom ?? []).map((s: any) => ({ id: s.id, nombre: s.nombre }))}
    />
  );
}
