import { requireCurrentUser } from "@/lib/auth";
import { getPendientesUsuario } from "@/lib/dashboard/pendientes";
import { iniciales } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import UserNavbar from "@/components/dashboard/UserNavbar";
import UserSidebar from "@/components/dashboard/UserSidebar";
import PendientesSidebar from "@/components/dashboard/PendientesSidebar";
import FooterCredits from "@/components/dashboard/FooterCredits";
import SessionGuard from "@/components/SessionGuard";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cu = await requireCurrentUser();
  const [{ pendientes, score }, notifCountResult] = await Promise.all([
    getPendientesUsuario(cu.profile.id),
    createAdminClient()
      .from("notificaciones_cliente")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", cu.profile.id)
      .eq("leida", false),
  ]);
  const notifCount = notifCountResult.count ?? 0;

  const displayName = cu.type === "personal" && cu.personalUser
    ? cu.personalUser.nombre
    : cu.profile.nombre_empresa;

  return (
    <div className="min-h-screen bg-gray-50">
      <UserNavbar
        nombreEmpresa={displayName}
        iniciales={iniciales(displayName)}
        isPersonal={cu.type === "personal"}
        empresaPadre={cu.type === "personal" ? cu.profile.nombre_empresa : undefined}
        notifCount={notifCount}
      />
      <UserSidebar effectiveRol={cu.effectiveRol} />
      <PendientesSidebar pendientes={pendientes} score={score} />
      <SessionGuard />
      <main className="pt-16 pl-56 pr-72 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
      <FooterCredits />
    </div>
  );
}
