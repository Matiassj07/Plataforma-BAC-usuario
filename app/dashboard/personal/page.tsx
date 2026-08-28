import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import PersonalClient from "@/components/dashboard/PersonalClient";

export default async function PersonalPage() {
  const cu = await requireCurrentUser();

  if (cu.effectiveRol === "cliente" || cu.effectiveRol === "asistente") {
    redirect("/dashboard");
  }

  const supabase = createAdminClient();

  const { data } = await supabase
    .from("personal")
    .select("id, nombre, cargo, area, fecha_renovacion, email, rol, auth_user_id")
    .eq("profile_id", cu.profile.id)
    .order("created_at", { ascending: true })
    .limit(500);

  const canEdit = cu.type === "profile" || cu.effectiveRol === "contador";

  return <PersonalClient initialEmpleados={data ?? []} soloLectura={!canEdit} />;
}
