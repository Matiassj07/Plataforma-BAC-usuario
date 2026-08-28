import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile, CurrentUser, PersonalUser, PersonalRolEnum } from "@/lib/types";

export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Check personal FIRST (admin client bypasses RLS for personal users)
  const admin = createAdminClient();
  const { data: personal } = await admin
    .from("personal")
    .select("id, auth_user_id, profile_id, nombre, email, rol, cargo, area")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (personal) {
    const { data: parentProfile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", personal.profile_id)
      .single();

    if (!parentProfile) return null;

    return {
      type: "personal",
      profile: parentProfile as Profile,
      personalUser: personal as PersonalUser,
      effectiveRol: (personal.rol as PersonalRolEnum) ?? "cliente",
    };
  }

  // Not personal — check profile with SSR client (RLS allows id = auth.uid())
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile) {
    return {
      type: "profile",
      profile: profile as Profile,
      effectiveRol: "admin",
    };
  }

  return null;
};

export async function requireUser(): Promise<Profile> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/login");
  if (cu.profile.suspendido) redirect("/suspendido");
  return cu.profile;
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const cu = await getCurrentUser();
  if (!cu) redirect("/login");
  if (cu.profile.suspendido) redirect("/suspendido");
  return cu;
}
