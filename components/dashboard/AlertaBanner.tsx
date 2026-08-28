import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertaBannerProps {
  brechasAbiertas: number;
  actasPendientes: number;
}

export default function AlertaBanner({
  brechasAbiertas,
  actasPendientes,
}: AlertaBannerProps) {
  if (brechasAbiertas === 0 && actasPendientes === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />

      <div className="flex flex-col gap-1 text-sm">
        {brechasAbiertas > 0 && (
          <p>
            Tienes{" "}
            <span className="font-semibold text-red-700">
              {brechasAbiertas} brecha{brechasAbiertas > 1 ? "s" : ""} abierta
              {brechasAbiertas > 1 ? "s" : ""}
            </span>
            .{" "}
            <Link
              href="/dashboard/brechas"
              className="text-bac-red font-medium underline underline-offset-2 hover:text-bac-red-dark"
            >
              Ver brechas
            </Link>
          </p>
        )}
        {actasPendientes > 0 && (
          <p>
            <span className="font-semibold text-red-700">
              {actasPendientes} acta{actasPendientes > 1 ? "s" : ""} pendiente
              {actasPendientes > 1 ? "s" : ""}
            </span>{" "}
            de firma.{" "}
            <Link
              href="/dashboard/dpd"
              className="text-bac-red font-medium underline underline-offset-2 hover:text-bac-red-dark"
            >
              Ver actas
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
