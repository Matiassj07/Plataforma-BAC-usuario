"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X, History } from "lucide-react";

const BASES_LICITUD = [
  "Consentimiento",
  "Obligación legal",
  "Orden judicial",
  "Interés público y ejercicio de poderes públicos",
  "Medidas precontractuales y contractuales",
  "Intereses vitales",
  "Datos provenientes de fuentes de acceso público",
  "Interés legítimo",
];

const BOOL_FIELDS = new Set([
  "perfiles_automatizados",
  "transferencias_internacionales",
  "cat_especiales_gran_escala",
  "obs_sistematica_publica",
  "trat_automatizado",
  "requiere_eipd",
]);

const NUMBER_FIELDS = new Set([
  "probabilidad",
  "impacto",
  "prob_residual",
  "imp_residual",
]);

const LONG_TEXT_FIELDS = new Set([
  "finalidad",
  "medidas_seguridad",
  "amenazas",
  "vulnerabilidades",
  "medidas_implementadas",
  "medidas_implementar",
]);

function displayValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Sí" : "No";
  if (Array.isArray(val)) return val.length > 0 ? val.join(", ") : "—";
  return String(val);
}

interface CambioInfo {
  version_cambio: number;
  valor_anterior: string | null;
  valor_nuevo: string | null;
}

export function EditableCell({
  value,
  field,
  onSave,
  className,
  cambios,
}: {
  value: unknown;
  field: string;
  onSave: (field: string, newValue: unknown) => Promise<void>;
  className?: string;
  cambios?: CambioInfo[];
}) {
  const [showCambios, setShowCambios] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  function startEdit() {
    if (BOOL_FIELDS.has(field)) {
      setEditVal(value === true ? "si" : value === false ? "no" : "");
    } else if (Array.isArray(value)) {
      setEditVal(value.join(", "));
    } else {
      setEditVal(value == null ? "" : String(value));
    }
    setEditing(true);
  }

  async function commit(val: string) {
    setSaving(true);
    try {
      let parsed: unknown = val;
      if (BOOL_FIELDS.has(field)) {
        parsed = val === "si" ? true : val === "no" ? false : null;
      } else if (NUMBER_FIELDS.has(field)) {
        parsed = val ? Number(val) : null;
      } else if (field === "categoria_datos" || field === "categorias_titulares") {
        parsed = val ? val.split(",").map((s) => s.trim()).filter(Boolean) : [];
      }
      await onSave(field, parsed);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !LONG_TEXT_FIELDS.has(field)) {
      e.preventDefault();
      commit(editVal);
    }
    if (e.key === "Escape") {
      setEditing(false);
    }
  }

  if (editing) {
    const isBool = BOOL_FIELDS.has(field);
    const isNum = NUMBER_FIELDS.has(field);
    const isLong = LONG_TEXT_FIELDS.has(field);
    const isBaseLicitud = field === "base_licitud";

    return (
      <div className="space-y-1">
        {isBool ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-xs focus:outline-none"
          >
            <option value="">—</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        ) : isNum ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-xs focus:outline-none"
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        ) : isBaseLicitud ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={BASES_LICITUD.includes(editVal) ? editVal : editVal ? "__otro__" : ""}
            onChange={(e) => setEditVal(e.target.value === "__otro__" ? "" : e.target.value)}
            className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-xs focus:outline-none"
          >
            <option value="">Selecciona...</option>
            {BASES_LICITUD.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
            <option value="__otro__">Otro (especificar)</option>
          </select>
        ) : isLong ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-xs focus:outline-none"
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-xs focus:outline-none"
          />
        )}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => commit(editVal)}
            disabled={saving}
            className="inline-flex items-center gap-0.5 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Check className="h-3 w-3" /> Guardar
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="inline-flex items-center gap-0.5 rounded border border-bac-gray-border px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-100"
          >
            <X className="h-3 w-3" /> Cancelar
          </button>
        </div>
      </div>
    );
  }

  const hasCambios = cambios && cambios.length > 0;

  return (
    <div
      className={`group/cell cursor-pointer rounded px-1 py-0.5 hover:bg-blue-50 relative ${className ?? ""}`}
      onClick={startEdit}
    >
      <span className={saving ? "opacity-50" : ""}>
        {displayValue(value)}
      </span>
      <Pencil className="ml-1 inline h-3 w-3 text-gray-400 opacity-0 group-hover/cell:opacity-100" />
      {hasCambios && (
        <span
          className="ml-1 inline-block relative"
          onClick={(e) => { e.stopPropagation(); setShowCambios(!showCambios); }}
        >
          <History className="inline h-3 w-3 text-amber-500 cursor-pointer" />
          {showCambios && (
            <div className="absolute z-20 left-0 top-5 w-64 bg-white border border-bac-gray-border rounded-lg shadow-lg p-2 text-xs">
              <p className="font-semibold text-gray-700 mb-1">Historial de cambios</p>
              <div className="py-0.5 border-b border-gray-100">
                <span className="text-bac-gray-text font-medium">Original:</span>{" "}
                <span className="text-gray-600">{cambios![0].valor_anterior || "—"}</span>
              </div>
              {cambios!.map((c, i) => (
                <div key={i} className="py-0.5 border-b border-gray-100 last:border-0">
                  <span className="text-bac-gray-text font-medium">Cambio {c.version_cambio}:</span>{" "}
                  <span className="text-gray-800">{c.valor_nuevo || "—"}</span>
                </div>
              ))}
              <div className="pt-1 mt-1 border-t border-bac-gray-border">
                <span className="text-bac-gray-text font-medium">Actual:</span>{" "}
                <span className="font-semibold text-gray-900">{displayValue(value)}</span>
              </div>
            </div>
          )}
        </span>
      )}
    </div>
  );
}
