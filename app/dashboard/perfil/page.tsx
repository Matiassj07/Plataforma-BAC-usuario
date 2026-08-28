import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import PerfilClient from "@/components/dashboard/PerfilClient";

export default async function PerfilPage() {
  const cu = await requireCurrentUser();
  if (cu.effectiveRol === "cliente") {
    redirect("/dashboard");
  }
  const profile = cu.profile;

  return (
    <PerfilClient
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
        email: profile.email,
        tipo_usuario: profile.tipo_usuario,
        es_pro: profile.pro_aprobado_por_admin,
        created_at: profile.created_at,
      }}
    />
  );
}
