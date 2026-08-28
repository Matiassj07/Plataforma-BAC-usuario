import { cn, scoreColorClasses } from "@/lib/utils";

interface ScoreCardProps {
  score: number | null;
}

export default function ScoreCard({ score }: ScoreCardProps) {
  const hasScore = score !== null;
  const colors = scoreColorClasses(score);

  const rangeLabel =
    score === null
      ? "Sin datos"
      : score < 40
        ? "Rojo"
        : score < 70
          ? "Amarillo"
          : "Verde";

  return (
    <div className="bg-white rounded-xl border border-bac-gray-border p-6">
      <p className="text-xs text-bac-gray-text uppercase tracking-wide font-medium">
        Score LOPDP
      </p>

      <div className="mt-2 flex items-baseline gap-1">
        <span className={cn("text-5xl font-extrabold", hasScore ? colors.text : "text-gray-300")}>
          {hasScore ? score : "—"}
        </span>
        {hasScore && <span className={cn("text-2xl", colors.text)}>%</span>}
      </div>

      <div className="h-2 rounded-full bg-bac-gray-alt mt-4">
        {hasScore && (
          <div
            className={cn("h-2 rounded-full", colors.label)}
            style={{ width: `${score}%` }}
          />
        )}
      </div>

      <p className={cn("text-xs mt-2", hasScore ? colors.text : "text-bac-gray-text")}>
        {rangeLabel}
      </p>
    </div>
  );
}
