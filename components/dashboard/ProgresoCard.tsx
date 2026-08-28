import { cn } from "@/lib/utils";
import {
  FileText,
  ShieldAlert,
  FolderOpen,
  Users,
  ClipboardCheck,
  CheckCircle2,
  Circle,
} from "lucide-react";

interface ProgresoCardProps {
  ratCount: number;
  matrizCount: number;
  docsSubidos: number;
  personalCount: number;
  actividadesCompletadas: number;
  actividadesTotal: number;
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const barColor =
    pct >= 70
      ? "bg-bac-score-verde"
      : pct >= 40
        ? "bg-bac-score-amarillo"
        : "bg-bac-score-rojo";

  return (
    <div className="h-1 w-20 rounded-full bg-bac-gray-alt">
      <div className={cn("h-1 rounded-full", barColor)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatusCheck({ done }: { done: boolean }) {
  return done ? (
    <CheckCircle2 className="w-4 h-4 text-bac-score-verde" />
  ) : (
    <Circle className="w-4 h-4 text-gray-300" />
  );
}

export default function ProgresoCard({
  ratCount,
  matrizCount,
  docsSubidos,
  personalCount,
  actividadesCompletadas,
  actividadesTotal,
}: ProgresoCardProps) {
  const items = [
    {
      icon: FileText,
      label: "RAT",
      status: <StatusCheck done={ratCount > 0} />,
    },
    {
      icon: ShieldAlert,
      label: "Matriz de Riesgos",
      status: <StatusCheck done={matrizCount > 0} />,
    },
    {
      icon: FolderOpen,
      label: "Documentos",
      status:
        docsSubidos > 0 ? (
          <StatusCheck done />
        ) : (
          <span className="text-xs text-bac-gray-text">Sin documentos</span>
        ),
    },
    {
      icon: Users,
      label: "Personal",
      status:
        personalCount > 0 ? (
          <StatusCheck done />
        ) : (
          <span className="text-xs text-bac-gray-text">Sin registros</span>
        ),
    },
    {
      icon: ClipboardCheck,
      label: "Plan DPD",
      status: (
        <div className="flex items-center gap-2">
          <span className="text-xs text-bac-gray-text">
            {actividadesCompletadas}/{actividadesTotal} actividades
          </span>
          <MiniBar value={actividadesCompletadas} max={actividadesTotal} />
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-bac-gray-border p-6">
      <h3 className="font-semibold text-base">Progreso de cumplimiento</h3>

      <ul className="mt-4">
        {items.map((item, i) => (
          <li
            key={item.label}
            className={cn(
              "flex items-center justify-between py-2 border-b border-bac-gray-border",
              i === items.length - 1 && "border-0"
            )}
          >
            <div className="flex items-center gap-2">
              <item.icon className="w-4 h-4 text-bac-gray-text" />
              <span className="text-sm">{item.label}</span>
            </div>
            {item.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
