import { cn } from "@/lib/utils";
import {
  FileText,
  ShieldAlert,
  FolderOpen,
  Users,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";

interface ResumenCumplimientoProps {
  ratCount: number;
  matrizCount: number;
  docsSubidos: number;
  personalCount: number;
  brechasAbiertas: number;
  actividadesCompletadas: number;
  actividadesTotal: number;
}

interface MetricCardData {
  icon: LucideIcon;
  label: string;
  value: string;
  valueColor?: string;
}

export default function ResumenCumplimiento({
  ratCount,
  matrizCount,
  docsSubidos,
  personalCount,
  brechasAbiertas,
  actividadesCompletadas,
  actividadesTotal,
}: ResumenCumplimientoProps) {
  const cards: MetricCardData[] = [
    {
      icon: FileText,
      label: "RAT",
      value: ratCount > 0 ? "Completado" : "Pendiente",
      valueColor: ratCount > 0 ? "text-bac-score-verde" : "text-amber-500",
    },
    {
      icon: ShieldAlert,
      label: "Riesgos",
      value: matrizCount > 0 ? "Completado" : "Pendiente",
      valueColor: matrizCount > 0 ? "text-bac-score-verde" : "text-amber-500",
    },
    {
      icon: FolderOpen,
      label: "Documentos",
      value: `${docsSubidos} subidos`,
    },
    {
      icon: Users,
      label: "Personal",
      value: `${personalCount} registros`,
    },
    {
      icon: AlertTriangle,
      label: "Brechas",
      value: brechasAbiertas > 0 ? `${brechasAbiertas} abiertas` : "Ninguna",
      valueColor: brechasAbiertas > 0 ? "text-bac-score-rojo" : undefined,
    },
    {
      icon: ClipboardCheck,
      label: "Plan DPD",
      value:
        actividadesTotal > 0
          ? `${actividadesCompletadas}/${actividadesTotal}`
          : "Sin plan",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl border border-bac-gray-border p-4 flex flex-col gap-1"
        >
          <card.icon className="w-5 h-5 text-bac-gray-text" />
          <span className="text-xs text-bac-gray-text">{card.label}</span>
          <span className={cn("text-sm font-semibold", card.valueColor)}>
            {card.value}
          </span>
        </div>
      ))}
    </div>
  );
}
