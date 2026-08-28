"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireCurrentUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getNotificaciones(limit = 10) {
  const cu = await requireCurrentUser();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notificaciones_cliente")
    .select("id, tipo, titulo, descripcion, modulo, leida, created_at")
    .eq("profile_id", cu.profile.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as {
    id: string;
    tipo: string;
    titulo: string;
    descripcion: string | null;
    modulo: string | null;
    leida: boolean;
    created_at: string;
  }[];
}

export async function marcarNotificacionLeida(notifId: string) {
  const cu = await requireCurrentUser();
  const supabase = createAdminClient();
  await supabase
    .from("notificaciones_cliente")
    .update({ leida: true })
    .eq("id", notifId)
    .eq("profile_id", cu.profile.id);
  revalidatePath("/dashboard");
}

export async function marcarTodasLeidas() {
  const cu = await requireCurrentUser();
  const supabase = createAdminClient();
  await supabase
    .from("notificaciones_cliente")
    .update({ leida: true })
    .eq("profile_id", cu.profile.id)
    .eq("leida", false);
  revalidatePath("/dashboard");
}
