"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, CheckCircle2, Circle, Upload, Plus, X, FileWarning, Download, Trash2, ShieldAlert, Pencil, Eye, AlertTriangle } from "lucide-react";
import { formatearFecha, cn } from "@/lib/utils";
import { DateInput } from "@/components/DateInput";
import type { DpdPlan, DpdActividad, DpdActa, DpdInformeBrecha } from "@/lib/types";
import { MESES } from "@/lib/types";
import { crearPlanDpd, crearActividadDpd, subirActaFirmada, crearActaNoConformidad, completarActividadDpd, descompletarActividadDpd, obtenerUrlDescarga, eliminarPlanDpd, eliminarActividadDpd, eliminarActaDpd, crearInformeBrechaDpd, eliminarInformeBrechaDpd, editarInformeBrechaDpd, cambiarEstadoBrecha, editarBrecha, eliminarBrecha } from "@/lib/dashboard/user-actions";

interface BrechaItem {
  id: string;
  tipo_incidente: string | null;
  descripcion: string | null;
  fecha_deteccion: string | null;
  estado: string | null;
  created_at: string;
}

function diasParaAutoEliminar(createdAt: string): number | null {
  const created = new Date(createdAt).getTime();
  const limite = created + 5 * 24 * 60 * 60 * 1000;
  const restante = limite - Date.now();
  if (restante <= 0) return 0;
  return Math.ceil(restante / (24 * 60 * 60 * 1000));
}

export default function DpdClient({
  plan,
  actividades,
  actas,
  informesBrechas = [],
  brechasSeguridad = [],
  soloLectura,
}: {
  plan: DpdPlan | null;
  actividades: DpdActividad[];
  actas: DpdActa[];
  informesBrechas?: DpdInformeBrecha[];
  brechasSeguridad?: BrechaItem[];
  soloLectura?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState<"crearPlan" | "subirPlan" | "addActividad" | "crearActa" | "crearBrecha" | null>(null);
  const [formError, setFormError] = useState("");
  const [detalleInforme, setDetalleInforme] = useState<DpdInformeBrecha | null>(null);
  const [editandoInforme, setEditandoInforme] = useState<DpdInformeBrecha | null>(null);
  const [editandoBrecha, setEditandoBrecha] = useState<BrechaItem | null>(null);

  const [planForm, setPlanForm] = useState({
    nombre_dpd: "",
    correo_dpd: "",
    periodo_inicio: "",
    periodo_fin: "",
  });
  const [planFile, setPlanFile] = useState<File | null>(null);

  const [actForm, setActForm] = useState({
    mes: "1",
    fase: "",
    descripcion: "",
    verificacion: "",
  });

  const [actaForm, setActaForm] = useState({
    descripcion_hallazgo: "",
    recomendacion: "",
  });

  function handleCrearPlan() {
    if (!planForm.nombre_dpd.trim() || !planForm.correo_dpd.trim() || !planForm.periodo_inicio || !planForm.periodo_fin) {
      setFormError("Todos los campos son obligatorios");
      return;
    }
    setFormError("");
    startTransition(async () => {
      try {
        let formData: FormData | undefined;
        if (planFile) {
          formData = new FormData();
          formData.set("file", planFile);
        }
        await crearPlanDpd(planForm, formData);
        setModal(null);
        setPlanForm({ nombre_dpd: "", correo_dpd: "", periodo_inicio: "", periodo_fin: "" });
        setPlanFile(null);
        router.refresh();
      } catch (e: any) {
        setFormError(e.message);
      }
    });
  }

  function handleAddActividad() {
    if (!plan) return;
    if (!actForm.fase.trim() || !actForm.descripcion.trim()) {
      setFormError("Fase y descripción son obligatorios");
      return;
    }
    setFormError("");
    startTransition(async () => {
      try {
        await crearActividadDpd(plan.id, {
          mes: parseInt(actForm.mes),
          fase: actForm.fase,
          descripcion: actForm.descripcion,
          verificacion: actForm.verificacion || undefined,
        });
        setModal(null);
        setActForm({ mes: "1", fase: "", descripcion: "", verificacion: "" });
        router.refresh();
      } catch (e: any) {
        setFormError(e.message);
      }
    });
  }

  async function handleSubirActa(actaId: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      try {
        await subirActaFirmada(actaId, fd);
        router.refresh();
      } catch (e: any) {
        setFormError(e.message);
      }
    });
  }

  function handleCrearActa() {
    if (!plan) return;
    if (!actaForm.descripcion_hallazgo.trim() || !actaForm.recomendacion.trim()) {
      setFormError("Descripción del hallazgo y recomendación son obligatorios");
      return;
    }
    setFormError("");
    startTransition(async () => {
      try {
        await crearActaNoConformidad(plan.id, actaForm);
        setModal(null);
        setActaForm({ descripcion_hallazgo: "", recomendacion: "" });
        router.refresh();
      } catch (e: any) {
        setFormError(e.message);
      }
    });
  }

  const completadas = actividades.filter((a) => a.completada).length;
  const actasPendientes = actas.filter((a) => a.estado === "pendiente_firma");

  // ---------- MODAL SUBIR / CREAR PLAN ----------
  if (modal === "crearPlan" || modal === "subirPlan") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{modal === "subirPlan" ? "Subir Plan DPD existente" : "Crear Plan DPD"}</h1>
          <button onClick={() => { setModal(null); setFormError(""); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        {formError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{formError}</div>}
        <div className="bg-white rounded-xl border border-bac-gray-border p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-bac-gray-text font-medium">Nombre del DPD *</label>
              <input
                value={planForm.nombre_dpd}
                onChange={(e) => setPlanForm((p) => ({ ...p, nombre_dpd: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm"
                placeholder="Nombre completo del delegado"
              />
            </div>
            <div>
              <label className="text-xs text-bac-gray-text font-medium">Correo del DPD *</label>
              <input
                type="email"
                value={planForm.correo_dpd}
                onChange={(e) => setPlanForm((p) => ({ ...p, correo_dpd: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm"
                placeholder="dpd@empresa.com"
              />
            </div>
            <div>
              <label className="text-xs text-bac-gray-text font-medium">Periodo inicio *</label>
              <DateInput
                value={planForm.periodo_inicio}
                onChange={(v) => setPlanForm((p) => ({ ...p, periodo_inicio: v }))}
                className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-bac-gray-text font-medium">Periodo fin *</label>
              <DateInput
                value={planForm.periodo_fin}
                onChange={(v) => setPlanForm((p) => ({ ...p, periodo_fin: v }))}
                className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm"
              />
            </div>
          </div>
          {modal === "subirPlan" && (
            <div>
              <label className="text-xs text-bac-gray-text font-medium">Archivo del plan (PDF o Word)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setPlanFile(e.target.files?.[0] ?? null)}
                className="w-full mt-1 text-sm"
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setModal(null); setFormError(""); }} className="px-4 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt transition">
              Cancelar
            </button>
            <button onClick={handleCrearPlan} disabled={isPending} className="px-6 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark transition disabled:opacity-60">
              {isPending ? "Creando..." : modal === "subirPlan" ? "Subir Plan" : "Crear Plan"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- MODAL AÑADIR ACTIVIDAD ----------
  if (modal === "addActividad") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Añadir Actividad</h1>
          <button onClick={() => { setModal(null); setFormError(""); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        {formError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{formError}</div>}
        <div className="bg-white rounded-xl border border-bac-gray-border p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-bac-gray-text font-medium">Mes *</label>
              <select
                value={actForm.mes}
                onChange={(e) => setActForm((p) => ({ ...p, mes: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm"
              >
                {MESES.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-bac-gray-text font-medium">Fase *</label>
              <input
                value={actForm.fase}
                onChange={(e) => setActForm((p) => ({ ...p, fase: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm"
                placeholder="Ej: Fase I"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-bac-gray-text font-medium">Descripción *</label>
              <textarea
                value={actForm.descripcion}
                onChange={(e) => setActForm((p) => ({ ...p, descripcion: e.target.value }))}
                rows={3}
                className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm"
                placeholder="Descripción de la actividad"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-bac-gray-text font-medium">Verificación</label>
              <textarea
                value={actForm.verificacion}
                onChange={(e) => setActForm((p) => ({ ...p, verificacion: e.target.value }))}
                rows={2}
                className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm"
                placeholder="Cómo verificar que se completó (opcional)"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setModal(null); setFormError(""); }} className="px-4 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt transition">
              Cancelar
            </button>
            <button onClick={handleAddActividad} disabled={isPending} className="px-6 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark transition disabled:opacity-60">
              {isPending ? "Añadiendo..." : "Añadir Actividad"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- MODAL CREAR ACTA DE NO CONFORMIDAD ----------
  if (modal === "crearActa") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Acta de No Conformidad</h1>
          <button onClick={() => { setModal(null); setFormError(""); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        {formError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{formError}</div>}
        <div className="bg-white rounded-xl border border-bac-gray-border p-6 space-y-4">
          <div>
            <label className="text-xs text-bac-gray-text font-medium">Descripción del hallazgo *</label>
            <textarea
              value={actaForm.descripcion_hallazgo}
              onChange={(e) => setActaForm((p) => ({ ...p, descripcion_hallazgo: e.target.value }))}
              rows={3}
              className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm"
              placeholder="Describa el hallazgo de no conformidad"
            />
          </div>
          <div>
            <label className="text-xs text-bac-gray-text font-medium">Recomendación *</label>
            <textarea
              value={actaForm.recomendacion}
              onChange={(e) => setActaForm((p) => ({ ...p, recomendacion: e.target.value }))}
              rows={3}
              className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm"
              placeholder="Recomendación para corregir la no conformidad"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setModal(null); setFormError(""); }} className="px-4 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt transition">
              Cancelar
            </button>
            <button onClick={handleCrearActa} disabled={isPending} className="px-6 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark transition disabled:opacity-60">
              {isPending ? "Creando..." : "Crear Acta"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- EMPTY STATE ----------
  if (!plan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plan DPD</h1>
            <p className="text-sm text-bac-gray-text mt-1">Delegado de Protección de Datos — Plan anual y actividades</p>
          </div>
          {!soloLectura && (
            <div className="flex gap-2">
              <button
                onClick={() => { setFormError(""); setPlanFile(null); setModal("subirPlan"); }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-bac-gray-border text-gray-700 rounded-lg hover:bg-bac-gray-alt transition"
              >
                <Upload className="w-4 h-4" />
                Subir plan existente
              </button>
              <button
                onClick={() => { setFormError(""); setPlanFile(null); setModal("crearPlan"); }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark transition"
              >
                <Plus className="w-4 h-4" />
                Crear Plan DPD
              </button>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-bac-gray-border p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Sin plan DPD</h3>
          <p className="mt-2 text-sm text-bac-gray-text max-w-md mx-auto">
            Crea tu plan de DPD o espera a que tu consultor BAC lo configure desde la plataforma admin.
          </p>
        </div>
      </div>
    );
  }

  // ---------- PLAN VIEW ----------
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plan DPD</h1>
          <p className="text-sm text-bac-gray-text mt-1">Delegado de Protección de Datos — Plan anual y actividades</p>
        </div>
        {!soloLectura && (
          <div className="flex gap-2">
            <button
              onClick={() => { setFormError(""); setActaForm({ descripcion_hallazgo: "", recomendacion: "" }); setModal("crearActa"); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-amber-300 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition"
            >
              <FileWarning className="w-4 h-4" />
              Acta de No Conformidad
            </button>
            <button
              onClick={() => { setFormError(""); setActForm({ mes: "1", fase: "", descripcion: "", verificacion: "" }); setModal("addActividad"); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark transition"
            >
              <Plus className="w-4 h-4" />
              Añadir Actividad
            </button>
            <button
              onClick={async () => {
                if (!confirm("¿Eliminar el plan DPD y todas sus actividades y actas?")) return;
                await eliminarPlanDpd(plan.id);
                router.refresh();
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar plan
            </button>
          </div>
        )}
      </div>

      {formError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{formError}</div>}

      <div className="bg-white rounded-xl border border-bac-gray-border p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-bac-gray-text text-xs">DPD</span>
            <p className="font-medium">{plan.nombre_dpd}</p>
          </div>
          <div>
            <span className="text-bac-gray-text text-xs">Correo DPD</span>
            <p className="font-medium">{plan.correo_dpd}</p>
          </div>
          <div>
            <span className="text-bac-gray-text text-xs">Periodo</span>
            <p className="font-medium">
              {formatearFecha(plan.periodo_inicio)} — {formatearFecha(plan.periodo_fin)}
            </p>
          </div>
          <div>
            <span className="text-bac-gray-text text-xs">Progreso</span>
            <p className="font-medium">{completadas}/{actividades.length} actividades</p>
          </div>
        </div>
      </div>

      {actasPendientes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h4 className="font-medium text-red-800 text-sm mb-2">
            Actas pendientes de firma ({actasPendientes.length})
          </h4>
          <div className="space-y-2">
            {actasPendientes.map((acta) => (
              <div key={acta.id} className="flex items-center justify-between bg-white rounded-lg border border-red-200 p-3">
                <div>
                  <p className="text-sm font-medium">{acta.numero_acta}</p>
                  <p className="text-xs text-bac-gray-text">{acta.descripcion_hallazgo}</p>
                </div>
                {!soloLectura && (
                  <label className="flex items-center gap-1.5 text-xs font-medium text-bac-red cursor-pointer px-3 py-1.5 border border-bac-red/20 rounded-lg hover:bg-bac-red/5">
                    <Upload className="w-3.5 h-3.5" />
                    Subir firmada
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSubirActa(acta.id, file);
                      }}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-bac-gray-border overflow-hidden">
        <div className="p-4 border-b border-bac-gray-border">
          <h3 className="font-medium text-sm">Actividades del plan</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bac-gray-alt">
                <th className="text-left px-4 py-2.5 font-medium text-bac-gray-text">Mes</th>
                <th className="text-left px-4 py-2.5 font-medium text-bac-gray-text">Fase</th>
                <th className="text-left px-4 py-2.5 font-medium text-bac-gray-text">Descripción</th>
                <th className="text-left px-4 py-2.5 font-medium text-bac-gray-text">Estado</th>
                {!soloLectura && <th className="px-2 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {actividades.map((act) => (
                <tr key={act.id} className="border-b border-bac-gray-border last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{MESES[act.mes - 1] ?? act.mes}</td>
                  <td className="px-4 py-3 text-bac-gray-text">{act.fase}</td>
                  <td className="px-4 py-3 text-bac-gray-text text-xs">{act.descripcion}</td>
                  <td className="px-4 py-3">
                    {soloLectura ? (
                      act.completada ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-700"><CheckCircle2 className="w-3.5 h-3.5" />Completada</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-bac-gray-text"><Circle className="w-3.5 h-3.5" />Pendiente</span>
                      )
                    ) : act.completada ? (
                      <button
                        onClick={() => {
                          if (!confirm("¿Marcar esta actividad como pendiente?")) return;
                          startTransition(async () => {
                            try {
                              await descompletarActividadDpd(act.id);
                              router.refresh();
                            } catch (e: any) {
                              setFormError(e.message);
                            }
                          });
                        }}
                        disabled={isPending}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completada
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (!confirm("¿Marcar esta actividad como completada?")) return;
                          startTransition(async () => {
                            try {
                              await completarActividadDpd(act.id);
                              router.refresh();
                            } catch (e: any) {
                              setFormError(e.message);
                            }
                          });
                        }}
                        disabled={isPending}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-60"
                      >
                        <Circle className="w-3.5 h-3.5" />
                        Completar
                      </button>
                    )}
                  </td>
                  {!soloLectura && (
                    <td className="px-2 py-3">
                      <button
                        onClick={() => {
                          if (!confirm("¿Eliminar esta actividad?")) return;
                          startTransition(async () => {
                            await eliminarActividadDpd(act.id);
                            router.refresh();
                          });
                        }}
                        disabled={isPending}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Eliminar actividad"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {actividades.length === 0 && (
                <tr>
                  <td colSpan={!soloLectura ? 5 : 4} className="px-4 py-8 text-center text-bac-gray-text">
                    Sin actividades. Añade la primera actividad del plan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-bac-gray-border overflow-hidden">
        <div className="p-4 border-b border-bac-gray-border flex items-center justify-between">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-amber-600" />
            Actas de No Conformidad
          </h3>
          <span className="text-xs text-bac-gray-text">{actas.length} acta{actas.length !== 1 ? "s" : ""}</span>
        </div>
        {actas.length === 0 ? (
          <div className="px-4 py-8 text-center text-bac-gray-text text-sm">
            Sin actas de no conformidad registradas.
          </div>
        ) : (
          <div className="divide-y divide-bac-gray-border">
            {actas.map((acta) => (
              <div key={acta.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">{acta.numero_acta}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${acta.estado === "firmada" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {acta.estado === "firmada" ? "Firmada" : "Pendiente de firma"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 mt-1">{acta.descripcion_hallazgo}</p>
                    <p className="text-xs text-bac-gray-text mt-1">Recomendación: {acta.recomendacion}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {acta.estado === "firmada" && acta.url_acta_firmada && (
                      <button
                        onClick={async () => {
                          try {
                            const url = await obtenerUrlDescarga("documentos", acta.url_acta_firmada!);
                            const res = await fetch(url);
                            const blob = await res.blob();
                            const objectUrl = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = objectUrl;
                            a.download = `${acta.numero_acta}_firmada.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(objectUrl);
                          } catch (e: any) {
                            alert(e.message);
                          }
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium text-green-700 px-3 py-1.5 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Descargar firmada
                      </button>
                    )}
                    {acta.estado !== "firmada" && !soloLectura && (
                      <label className="flex items-center gap-1.5 text-xs font-medium text-bac-red cursor-pointer px-3 py-1.5 border border-bac-red/20 rounded-lg hover:bg-bac-red/5">
                        <Upload className="w-3.5 h-3.5" />
                        Subir firmada
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleSubirActa(acta.id, file);
                          }}
                        />
                      </label>
                    )}
                    {!soloLectura && (
                      <button
                        onClick={() => {
                          if (!confirm("¿Eliminar esta acta?")) return;
                          startTransition(async () => {
                            await eliminarActaDpd(acta.id);
                            router.refresh();
                          });
                        }}
                        disabled={isPending}
                        className="flex items-center gap-1.5 text-xs font-medium text-red-600 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Informe de brechas de seguridad */}
      <div className="bg-white rounded-xl border border-bac-gray-border overflow-hidden">
        <div className="p-4 border-b border-bac-gray-border flex items-center justify-between">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-bac-red" />
            Informe de brechas de seguridad
          </h3>
          {!soloLectura && (
            <button
              onClick={() => { setFormError(""); setModal("crearBrecha"); }}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700 px-3 py-1.5 border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo informe
            </button>
          )}
        </div>
        {informesBrechas.length === 0 ? (
          <div className="px-4 py-8 text-center text-bac-gray-text text-sm">
            No hay informes de brechas registrados.
          </div>
        ) : (
          <div className="divide-y divide-bac-gray-border">
            {informesBrechas.map((inf) => (
              <div key={inf.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{inf.mes} {inf.anio}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${inf.hubo_brecha ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                        {inf.hubo_brecha ? "Brecha detectada" : "Sin brecha"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 mt-1 whitespace-pre-line line-clamp-3">{inf.contenido}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setDetalleInforme(inf)}
                      className="rounded p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                      title="Ver detalle"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {!soloLectura && (
                      <button
                        onClick={() => setEditandoInforme(inf)}
                        className="rounded p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                        title="Editar informe"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const content = `INFORME MENSUAL DE BRECHAS DE SEGURIDAD\n\nMes: ${inf.mes} ${inf.anio}\n¿Hubo brecha?: ${inf.hubo_brecha ? "SÍ" : "NO"}\n\n${inf.contenido}`;
                        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `informe_brechas_${inf.mes}_${inf.anio}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="rounded p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                      title="Descargar informe"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {!soloLectura && (
                      <button
                        onClick={() => {
                          if (!confirm("¿Eliminar este informe de brechas?")) return;
                          startTransition(async () => {
                            await eliminarInformeBrechaDpd(inf.id);
                            router.refresh();
                          });
                        }}
                        disabled={isPending}
                        className="rounded p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="Eliminar informe"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Brechas de seguridad (auto-creadas desde informes) */}
      <div className="bg-white rounded-xl border border-bac-gray-border overflow-hidden">
        <div className="p-4 border-b border-bac-gray-border flex items-center justify-between">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Brechas de seguridad
          </h3>
        </div>
        {brechasSeguridad.length === 0 ? (
          <div className="px-4 py-8 text-center text-bac-gray-text text-sm">
            No hay brechas de seguridad registradas.
          </div>
        ) : (
          <div className="divide-y divide-bac-gray-border">
            {brechasSeguridad.map((b) => {
              const diasRestantes = b.estado === "cerrada" ? diasParaAutoEliminar(b.created_at) : null;
              return (
                <div key={b.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{b.tipo_incidente ?? "—"}</p>
                      {b.descripcion && (
                        <p className="text-xs text-gray-700 mt-0.5 line-clamp-2">{b.descripcion}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-bac-gray-text">{formatearFecha(b.created_at)}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          b.estado === "abierta" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                        }`}>
                          {b.estado ?? "—"}
                        </span>
                        {diasRestantes !== null && (
                          <span className="text-[10px] text-red-500">
                            {diasRestantes === 0 ? "Se eliminará pronto" : `Se elimina en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}`}
                          </span>
                        )}
                      </div>
                    </div>
                    {!soloLectura && (
                      <div className="flex items-center gap-1 shrink-0">
                        {b.estado !== "cerrada" && (
                          <button
                            disabled={isPending}
                            onClick={() => startTransition(async () => { await cambiarEstadoBrecha(b.id, "cerrada"); router.refresh(); })}
                            className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                          >
                            Cerrar
                          </button>
                        )}
                        {b.estado === "cerrada" && (
                          <button
                            disabled={isPending}
                            onClick={() => startTransition(async () => { await cambiarEstadoBrecha(b.id, "abierta"); router.refresh(); })}
                            className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            Reabrir
                          </button>
                        )}
                        <button
                          onClick={() => setEditandoBrecha(b)}
                          className="rounded p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                          title="Editar brecha"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (!confirm("¿Eliminar esta brecha de seguridad?")) return;
                            startTransition(async () => { await eliminarBrecha(b.id); router.refresh(); });
                          }}
                          disabled={isPending}
                          className="rounded p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Eliminar brecha"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal === "crearBrecha" && plan && (
        <CrearInformeBrechaModalUser planId={plan.id} onClose={() => setModal(null)} />
      )}

      {detalleInforme && (
        <DetalleInformeModalUser informe={detalleInforme} onClose={() => setDetalleInforme(null)} />
      )}

      {editandoInforme && (
        <EditarInformeModalUser informe={editandoInforme} onClose={() => setEditandoInforme(null)} />
      )}

      {editandoBrecha && (
        <EditarBrechaModalUser brecha={editandoBrecha} onClose={() => setEditandoBrecha(null)} />
      )}
    </div>
  );
}

function CrearInformeBrechaModalUser({ planId, onClose }: { planId: string; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mes, setMes] = useState(MESES[new Date().getMonth()]);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [huboBrecha, setHuboBrecha] = useState(false);
  const [contenido, setContenido] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contenido.trim()) {
      setError("El contenido del informe es obligatorio.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await crearInformeBrechaDpd({
          plan_id: planId,
          mes,
          anio,
          hubo_brecha: huboBrecha,
          contenido: contenido.trim(),
        });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear el informe.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Nuevo informe de brechas</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mes</label>
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm"
              >
                {MESES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Año</label>
              <input
                type="number"
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                min={2020}
                max={2030}
                className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={huboBrecha}
                onChange={(e) => setHuboBrecha(e.target.checked)}
                className="rounded border-gray-300"
              />
              ¿Hubo brecha de seguridad durante este periodo?
            </label>
          </div>

          {huboBrecha ? (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Detalle de la brecha (acciones tomadas, notificaciones, responsables, medios utilizados)
              </label>
              <textarea
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm"
                rows={6}
                placeholder="Describa la brecha detectada, cómo se actuó, qué se hizo al respecto, a través de qué medio se trató, quién fue notificado, responsables y toda la información relevante..."
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Declaración de que no hubo brecha
              </label>
              <textarea
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm"
                rows={4}
                placeholder="Se certifica que durante el periodo no se detectaron brechas de seguridad. Se notifica que no hubo incidentes y se detalla la información pertinente..."
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-bac-gray-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-bac-gray-alt">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="rounded-lg bg-bac-red px-4 py-2 text-sm font-medium text-white hover:bg-bac-red-dark disabled:opacity-60">
              {isPending ? "Guardando..." : "Crear informe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DetalleInformeModalUser({ informe, onClose }: { informe: DpdInformeBrecha; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Detalle del informe</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs font-medium text-bac-gray-text">Mes</span>
              <p className="text-sm font-medium">{informe.mes}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-bac-gray-text">Año</span>
              <p className="text-sm font-medium">{informe.anio}</p>
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-bac-gray-text">¿Hubo brecha?</span>
            <p className="text-sm mt-1">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${informe.hubo_brecha ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                {informe.hubo_brecha ? "Sí" : "No"}
              </span>
            </p>
          </div>
          <div>
            <span className="text-xs font-medium text-bac-gray-text">Contenido</span>
            <p className="mt-1 text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-3">{informe.contenido}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-lg border border-bac-gray-border px-4 py-2 text-sm font-medium hover:bg-bac-gray-alt">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function EditarInformeModalUser({ informe, onClose }: { informe: DpdInformeBrecha; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mes, setMes] = useState(informe.mes);
  const [anio, setAnio] = useState(informe.anio);
  const [huboBrecha, setHuboBrecha] = useState(informe.hubo_brecha);
  const [contenido, setContenido] = useState(informe.contenido);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contenido.trim()) { setError("El contenido del informe es obligatorio."); return; }
    setError(null);
    startTransition(async () => {
      try {
        await editarInformeBrechaDpd(informe.id, { mes, anio, hubo_brecha: huboBrecha, contenido: contenido.trim() });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al editar el informe.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Editar informe de brechas</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mes</label>
              <select value={mes} onChange={(e) => setMes(e.target.value)} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm">
                {MESES.map((m) => (<option key={m} value={m}>{m}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Año</label>
              <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} min={2020} max={2030} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" checked={huboBrecha} onChange={(e) => setHuboBrecha(e.target.checked)} className="rounded border-gray-300" />
              ¿Hubo brecha de seguridad durante este periodo?
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Contenido</label>
            <textarea value={contenido} onChange={(e) => setContenido(e.target.value)} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm" rows={6} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-bac-gray-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-bac-gray-alt">Cancelar</button>
            <button type="submit" disabled={isPending} className="rounded-lg bg-bac-red px-4 py-2 text-sm font-medium text-white hover:bg-bac-red-dark disabled:opacity-60">
              {isPending ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditarBrechaModalUser({ brecha, onClose }: { brecha: BrechaItem; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tipoIncidente, setTipoIncidente] = useState(brecha.tipo_incidente ?? "");
  const [descripcion, setDescripcion] = useState(brecha.descripcion ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipoIncidente.trim()) { setError("El tipo de incidente es obligatorio."); return; }
    setError(null);
    startTransition(async () => {
      try {
        await editarBrecha(brecha.id, { tipo_incidente: tipoIncidente.trim(), descripcion: descripcion.trim() });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al editar la brecha.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Editar brecha de seguridad</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de incidente *</label>
            <input value={tipoIncidente} onChange={(e) => setTipoIncidente(e.target.value)} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/30" placeholder="Ej: Acceso no autorizado" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/30" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-bac-gray-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-bac-gray-alt">Cancelar</button>
            <button type="submit" disabled={isPending} className="rounded-lg bg-bac-red px-4 py-2 text-sm font-medium text-white hover:bg-bac-red-dark disabled:opacity-60">
              {isPending ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
