import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function scoreColorClasses(score: number | null | undefined): {
  bg: string;
  text: string;
  label: string;
} {
  const s = score ?? 0;
  if (s < 40) return { bg: "bg-red-100", text: "text-bac-score-rojo", label: "bg-bac-score-rojo" };
  if (s < 70)
    return { bg: "bg-amber-100", text: "text-bac-score-amarillo", label: "bg-bac-score-amarillo" };
  return { bg: "bg-green-100", text: "text-bac-score-verde", label: "bg-bac-score-verde" };
}

export function diasDesde(fecha: string | null | undefined): number | null {
  if (!fecha) return null;
  const ms = Date.now() - new Date(fecha).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—";
  const str = fecha.length === 10 ? fecha + "T00:00:00" : fecha;
  const d = new Date(str);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const aaaa = d.getFullYear();
  return `${dd}/${mm}/${aaaa}`;
}

export function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
