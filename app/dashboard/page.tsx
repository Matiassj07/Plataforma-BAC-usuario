import { requireCurrentUser } from "@/lib/auth";
import { getUserDashboardData } from "@/lib/dashboard/user-data";
import ScoreCard from "@/components/dashboard/ScoreCard";
import ProgresoCard from "@/components/dashboard/ProgresoCard";
import ResumenCumplimiento from "@/components/dashboard/ResumenCumplimiento";
import AlertaBanner from "@/components/dashboard/AlertaBanner";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cu = await requireCurrentUser();
  const data = await getUserDashboardData(cu.profile.id);

  const displayName = cu.type === "personal" && cu.personalUser
    ? cu.personalUser.nombre
    : data.profile.nombre_empresa;

  const actasPendientes = data.dpd.actas.filter((a) => a.estado === "pendiente_firma").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {displayName}
        </h1>
        <p className="text-sm text-bac-gray-text mt-1">
          Resumen de tu cumplimiento LOPDP
        </p>
      </div>

      <AlertaBanner brechasAbiertas={data.brechasAbiertas} actasPendientes={actasPendientes} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ScoreCard score={data.score} />
        <div className="lg:col-span-2">
          <ProgresoCard
            ratCount={data.ratCount}
            matrizCount={data.matrizCount}
            docsSubidos={data.docsSubidos}
            personalCount={data.personalCount}
            actividadesCompletadas={data.actividadesCompletadas}
            actividadesTotal={data.actividadesTotal}
          />
        </div>
      </div>

      <ResumenCumplimiento
        ratCount={data.ratCount}
        matrizCount={data.matrizCount}
        docsSubidos={data.docsSubidos}
        personalCount={data.personalCount}
        brechasAbiertas={data.brechasAbiertas}
        actividadesCompletadas={data.actividadesCompletadas}
        actividadesTotal={data.actividadesTotal}
      />
    </div>
  );
}
