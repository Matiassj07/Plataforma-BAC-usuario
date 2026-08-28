"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Calendar, User, Building2, ClipboardList, Pencil, X, Check } from "lucide-react";
import { formatearFecha } from "@/lib/utils";
import { DateInput } from "@/components/DateInput";
import { crearPlanUsuario, actualizarPlanUsuario, eliminarPlanUsuario } from "@/lib/dashboard/user-actions";
import type { PlanImplementacion } from "@/lib/types";

interface Props {
  planes: PlanImplementacion[];
  actividadesRat: { id: string; index: number; nombre: string }[];
  actividadesRiesgo: { id: string; index: number; nombre: string }[];
  documentos: { id: string; nombre: string }[];
  soloLectura?: boolean;
}

const ESTADO_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pendiente: { bg: "bg-amber-100", text: "text-amber-800", label: "Pendiente" },
  en_progreso: { bg: "bg-blue-100", text: "text-blue-800", label: "En progreso" },
  completado: { bg: "bg-green-100", text: "text-green-800", label: "Completado" },
};

export default function PlanImplementacionClient({ planes, actividadesRat, actividadesRiesgo, documentos, soloLectura }: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["rat", "riesgos", "documentos"]));
  const [creando, setCreando] = useState<"rat" | "riesgos" | "documentos" | null>(null);
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());

  const planesRat = planes.filter((p) => p.tipo === "rat");
  const planesRiesgos = planes.filter((p) => p.tipo === "riesgos");
  const planesDocs = planes.filter((p) => p.tipo === "documentos");

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function togglePlan(id: string) {
    setExpandedPlans((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-bold text-gray-900">Plan de Implementación</h1>

      <PlanSection
        titulo="Plan del RAT"
        planes={planesRat}
        actividades={actividadesRat}
        isExpanded={expandedSections.has("rat")}
        onToggle={() => toggleSection("rat")}
        onCreate={soloLectura ? undefined : () => setCreando("rat")}
        expandedPlans={expandedPlans}
        onTogglePlan={togglePlan}
        soloLectura={soloLectura}
      />

      <PlanSection
        titulo="Plan de Riesgos"
        planes={planesRiesgos}
        actividades={actividadesRiesgo}
        isExpanded={expandedSections.has("riesgos")}
        onToggle={() => toggleSection("riesgos")}
        onCreate={soloLectura ? undefined : () => setCreando("riesgos")}
        expandedPlans={expandedPlans}
        onTogglePlan={togglePlan}
        soloLectura={soloLectura}
      />

      <PlanSection
        titulo="Plan de Documentos"
        planes={planesDocs}
        actividades={documentos.map((d, i) => ({ id: d.id, index: i + 1, nombre: d.nombre }))}
        isExpanded={expandedSections.has("documentos")}
        onToggle={() => toggleSection("documentos")}
        onCreate={soloLectura ? undefined : () => setCreando("documentos")}
        expandedPlans={expandedPlans}
        onTogglePlan={togglePlan}
        soloLectura={soloLectura}
      />

      {creando && (
        <CrearPlanModal
          tipo={creando}
          actividades={
            creando === "rat"
              ? actividadesRat
              : creando === "riesgos"
                ? actividadesRiesgo
                : documentos.map((d, i) => ({ id: d.id, index: i + 1, nombre: d.nombre }))
          }
          onClose={() => setCreando(null)}
        />
      )}
    </div>
  );
}

function PlanSection({
  titulo,
  planes,
  actividades,
  isExpanded,
  onToggle,
  onCreate,
  expandedPlans,
  onTogglePlan,
  soloLectura,
}: {
  titulo: string;
  planes: PlanImplementacion[];
  actividades: { id: string; index: number; nombre: string }[];
  isExpanded: boolean;
  onToggle: () => void;
  onCreate?: () => void;
  expandedPlans: Set<string>;
  onTogglePlan: (id: string) => void;
  soloLectura?: boolean;
}) {
  return (
    <div className="rounded-xl border border-bac-gray-border bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown className="h-4 w-4 text-bac-gray-text" /> : <ChevronRight className="h-4 w-4 text-bac-gray-text" />}
          <ClipboardList className="h-4 w-4 text-bac-red" />
          <span className="text-sm font-semibold text-gray-900">{titulo}</span>
          <span className="text-[10px] text-bac-gray-text bg-bac-gray-alt px-2 py-0.5 rounded-full">
            {planes.length} plan{planes.length !== 1 ? "es" : ""}
          </span>
        </div>
        {onCreate && (
          <button
            onClick={(e) => { e.stopPropagation(); onCreate(); }}
            className="inline-flex items-center gap-1 text-xs font-medium text-bac-red hover:text-bac-red-dark px-2 py-1 rounded hover:bg-bac-red/5"
          >
            <Plus className="h-3 w-3" /> Crear plan
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="border-t border-bac-gray-border divide-y divide-bac-gray-border">
          {planes.length === 0 ? (
            <p className="px-4 py-3 text-xs text-bac-gray-text">No hay planes en esta sección.</p>
          ) : (
            planes.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                actividades={actividades}
                isExpanded={expandedPlans.has(plan.id)}
                onToggle={() => onTogglePlan(plan.id)}
                soloLectura={soloLectura}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  actividades,
  isExpanded,
  onToggle,
  soloLectura,
}: {
  plan: PlanImplementacion;
  actividades: { id: string; index: number; nombre: string }[];
  isExpanded: boolean;
  onToggle: () => void;
  soloLectura?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({
    titulo: plan.titulo,
    responsable: plan.responsable ?? "",
    departamento: plan.departamento ?? "",
    actividad_nombre: plan.actividad_nombre ?? "",
    actividad_realizar: plan.actividad_realizar ?? "",
    fecha_inicio: plan.fecha_inicio ?? "",
    fecha_fin: plan.fecha_fin ?? "",
  });
  const badge = ESTADO_BADGE[plan.estado] ?? ESTADO_BADGE.pendiente;
  const actOrigen = actividades.find((a) => a.id === plan.actividad_origen_id);

  function handleEstadoChange(nuevoEstado: string) {
    startTransition(async () => {
      await actualizarPlanUsuario(plan.id, { estado: nuevoEstado });
    });
  }

  function handleEliminar() {
    if (!confirm("¿Eliminar este plan?")) return;
    startTransition(async () => {
      await eliminarPlanUsuario(plan.id);
    });
  }

  function handleGuardarEdicion() {
    if (!edit.titulo.trim()) return;
    startTransition(async () => {
      await actualizarPlanUsuario(plan.id, {
        titulo: edit.titulo.trim(),
        responsable: edit.responsable.trim() || undefined,
        departamento: edit.departamento.trim() || undefined,
        actividad_nombre: edit.actividad_nombre.trim() || undefined,
        actividad_realizar: edit.actividad_realizar.trim() || undefined,
        fecha_inicio: edit.fecha_inicio || undefined,
        fecha_fin: edit.fecha_fin || undefined,
      });
      setEditing(false);
    });
  }

  const inputClass = "w-full px-2 py-1 text-xs border border-bac-gray-border rounded-lg focus:outline-none focus:ring-1 focus:ring-bac-red";

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="flex items-center gap-3">
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-bac-gray-text" /> : <ChevronRight className="h-3.5 w-3.5 text-bac-gray-text" />}
          <div>
            <span className="text-sm font-medium text-gray-900">{plan.titulo}</span>
            {actOrigen && (
              <p className="text-[10px] text-bac-gray-text">#{actOrigen.index} — {actOrigen.nombre}</p>
            )}
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>
      </div>

      {isExpanded && !editing && (
        <div className="border-t border-bac-gray-border px-4 py-3 space-y-3 bg-gray-50/50">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <User className="h-3 w-3 text-bac-gray-text" />
              <span className="text-bac-gray-text">Responsable:</span>
              <span className="font-medium text-gray-800">{plan.responsable || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3 w-3 text-bac-gray-text" />
              <span className="text-bac-gray-text">Departamento:</span>
              <span className="font-medium text-gray-800">{plan.departamento || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ClipboardList className="h-3 w-3 text-bac-gray-text" />
              <span className="text-bac-gray-text">Actividad:</span>
              <span className="font-medium text-gray-800">{plan.actividad_nombre || "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-bac-gray-text" />
              <span className="text-bac-gray-text">Plazo:</span>
              <span className="font-medium text-gray-800">
                {plan.fecha_inicio ? formatearFecha(plan.fecha_inicio) : "—"} → {plan.fecha_fin ? formatearFecha(plan.fecha_fin) : "—"}
              </span>
            </div>
          </div>

          {plan.actividad_realizar && (
            <div className="text-xs">
              <span className="text-bac-gray-text">Actividad a realizar:</span>
              <p className="mt-1 text-gray-800 whitespace-pre-line">{plan.actividad_realizar}</p>
            </div>
          )}

          {!soloLectura && (
            <div className="flex items-center justify-between pt-2 border-t border-bac-gray-border">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-bac-gray-text">Estado:</span>
                <select
                  value={plan.estado}
                  onChange={(e) => handleEstadoChange(e.target.value)}
                  disabled={isPending}
                  className="rounded border border-bac-gray-border px-2 py-0.5 text-[11px] disabled:opacity-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en_progreso">En progreso</option>
                  <option value="completado">Completado</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setEditing(true); setEdit({ titulo: plan.titulo, responsable: plan.responsable ?? "", departamento: plan.departamento ?? "", actividad_nombre: plan.actividad_nombre ?? "", actividad_realizar: plan.actividad_realizar ?? "", fecha_inicio: plan.fecha_inicio ?? "", fecha_fin: plan.fecha_fin ?? "" }); }}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleEliminar(); }}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" /> Eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isExpanded && editing && (
        <div className="border-t border-bac-gray-border px-4 py-3 space-y-3 bg-amber-50/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-bac-gray-text">Título del plan *</label>
              <input value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} className={inputClass} placeholder="Título del plan" />
            </div>
            <div>
              <label className="text-[11px] text-bac-gray-text">Responsable</label>
              <input value={edit.responsable} onChange={(e) => setEdit({ ...edit, responsable: e.target.value })} className={inputClass} placeholder="Nombre del responsable" />
            </div>
            <div>
              <label className="text-[11px] text-bac-gray-text">Departamento</label>
              <input value={edit.departamento} onChange={(e) => setEdit({ ...edit, departamento: e.target.value })} className={inputClass} placeholder="Ej: Talento humano" />
            </div>
            <div>
              <label className="text-[11px] text-bac-gray-text">Nombre de la actividad</label>
              <input value={edit.actividad_nombre} onChange={(e) => setEdit({ ...edit, actividad_nombre: e.target.value })} className={inputClass} placeholder="Nombre de la actividad" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] text-bac-gray-text">Actividad a realizar</label>
              <input value={edit.actividad_realizar} onChange={(e) => setEdit({ ...edit, actividad_realizar: e.target.value })} className={inputClass} placeholder="Describa el plan o implementación" />
            </div>
            <div>
              <label className="text-[11px] text-bac-gray-text">Fecha inicio</label>
              <DateInput value={edit.fecha_inicio} onChange={(v) => setEdit({ ...edit, fecha_inicio: v })} className={inputClass} />
            </div>
            <div>
              <label className="text-[11px] text-bac-gray-text">Fecha fin</label>
              <DateInput value={edit.fecha_fin} onChange={(v) => setEdit({ ...edit, fecha_fin: v })} className={inputClass} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-bac-gray-border">
            <button onClick={(e) => { e.stopPropagation(); setEditing(false); }} className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100">
              <X className="h-3 w-3" /> Cancelar
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleGuardarEdicion(); }} disabled={isPending || !edit.titulo.trim()} className="inline-flex items-center gap-1 text-xs text-white bg-bac-red hover:bg-bac-red-dark px-3 py-1 rounded disabled:opacity-50">
              <Check className="h-3 w-3" /> {isPending ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CrearPlanModal({
  tipo,
  actividades,
  onClose,
}: {
  tipo: "rat" | "riesgos" | "documentos";
  actividades: { id: string; index: number; nombre: string }[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [responsable, setResponsable] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [actividadNombre, setActividadNombre] = useState("");
  const [actividadRealizar, setActividadRealizar] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [actividadOrigenId, setActividadOrigenId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tipoLabel = tipo === "rat" ? "RAT" : tipo === "riesgos" ? "Riesgos" : "Documentos";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) { setError("El título es obligatorio."); return; }
    setError(null);
    startTransition(async () => {
      try {
        await crearPlanUsuario({
          tipo,
          actividad_origen_id: actividadOrigenId || undefined,
          titulo: titulo.trim(),
          responsable: responsable.trim() || undefined,
          departamento: departamento.trim() || undefined,
          actividad_nombre: actividadNombre.trim() || undefined,
          actividad_realizar: actividadRealizar.trim() || undefined,
          fecha_inicio: fechaInicio || undefined,
          fecha_fin: fechaFin || undefined,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear el plan.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Crear plan — {tipoLabel}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Actividad vinculada</label>
            <select
              value={actividadOrigenId}
              onChange={(e) => setActividadOrigenId(e.target.value)}
              className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm"
            >
              <option value="">Sin vincular</option>
              {actividades.map((a) => (
                <option key={a.id} value={a.id}>#{a.index} — {a.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Título del plan *</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm" placeholder="Título del plan" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Responsable</label>
              <input value={responsable} onChange={(e) => setResponsable(e.target.value)} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm" placeholder="Nombre" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Departamento</label>
              <input value={departamento} onChange={(e) => setDepartamento(e.target.value)} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm" placeholder="Ej: Talento humano" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre de la actividad</label>
            <input value={actividadNombre} onChange={(e) => setActividadNombre(e.target.value)} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm" placeholder="Nombre de la actividad" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Actividad a realizar</label>
            <textarea value={actividadRealizar} onChange={(e) => setActividadRealizar(e.target.value)} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm" rows={3} placeholder="Describa el plan" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha inicio</label>
              <DateInput value={fechaInicio} onChange={setFechaInicio} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha fin</label>
              <DateInput value={fechaFin} onChange={setFechaFin} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-bac-gray-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-bac-gray-alt">Cancelar</button>
            <button type="submit" disabled={isPending} className="rounded-lg bg-bac-red px-4 py-2 text-sm font-medium text-white hover:bg-bac-red-dark disabled:opacity-60">
              {isPending ? "Creando..." : "Crear plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
