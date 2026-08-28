"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Download, FileSpreadsheet, Plus, Upload, X, Trash2 } from "lucide-react";
import { formatearFecha, cn } from "@/lib/utils";
import { DateInput } from "@/components/DateInput";
import type { MatrizVersion, ActividadRiesgo, RatVersion } from "@/lib/types";
import { GRUPOS_RIESGO, COLUMNAS_RIESGO } from "@/lib/types";
import { crearMatrizCompleta, actualizarActividadRiesgo, agregarActividadRiesgo, eliminarActividadRiesgo, eliminarMatrizRiesgos, crearPlanUsuario } from "@/lib/dashboard/user-actions";
import { analizarMatrizConIA } from "@/lib/dashboard/ia-actions";
import { EditableCell } from "./EditableCell";
import { BotonAnalisisIA, ConfirmacionIAModal, ResultadoIAMatrizModal } from "./AnalisisIAModal";

const NIVEL_COLORS: Record<string, string> = {
  critico: "bg-bac-riesgo-critico text-white",
  alto: "bg-bac-riesgo-alto text-white",
  medio: "bg-bac-riesgo-medio text-white",
  bajo: "bg-bac-riesgo-bajo text-white",
  muy_bajo: "bg-bac-riesgo-muy-bajo text-white",
};

const GRUPO_HEX: Record<string, string> = {
  "Tratamiento de Datos Personales": "1E3A8A",
  "Análisis de Riesgo Inherente": "9333EA",
  EIPD: "0891B2",
  "Plan de Mitigación / Riesgo Residual": "059669",
};

const NIVEL_HEX: Record<string, string> = {
  critico: "B91C1C",
  alto: "EA580C",
  medio: "CA8A04",
  bajo: "16A34A",
  muy_bajo: "0891B2",
};

const READ_ONLY_RIESGO_FIELDS = new Set(["riesgo_inherente", "nivel_riesgo", "riesgo_residual", "nivel_riesgo_residual"]);

function celdaRiesgo(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Sí" : "No";
  if (Array.isArray(val)) return val.length > 0 ? val.join(", ") : "—";
  return String(val);
}

function calcularNivel(prob: number, imp: number): string {
  const r = prob * imp;
  if (r >= 20) return "critico";
  if (r >= 12) return "alto";
  if (r >= 6) return "medio";
  if (r >= 3) return "bajo";
  return "muy_bajo";
}

function nivelLabel(nivel: string): string {
  const labels: Record<string, string> = { critico: "Crítico", alto: "Alto", medio: "Medio", bajo: "Bajo", muy_bajo: "Muy bajo" };
  return labels[nivel] ?? nivel;
}

function normalizarNivel(raw: unknown): string | null {
  if (!raw || typeof raw !== "string") return null;
  const map: Record<string, string> = {
    "Crítico": "critico", critico: "critico",
    "Alto": "alto", alto: "alto",
    "Medio": "medio", medio: "medio",
    "Bajo": "bajo", bajo: "bajo",
    "Muy bajo": "muy_bajo", muy_bajo: "muy_bajo",
  };
  return map[raw] ?? null;
}

interface RiesgoForm {
  codigo: string;
  actividad_tratamiento: string;
  area_departamento: string;
  cat_especiales_gran_escala: string;
  obs_sistematica_publica: string;
  trat_automatizado: string;
  activos_relacionados: string;
  base_legal: string;
  articulo_ley: string;
  amenazas: string;
  vulnerabilidades: string;
  medidas_implementadas: string;
  probabilidad: string;
  impacto: string;
  requiere_eipd: string;
  medidas_implementar: string;
  prob_residual: string;
  imp_residual: string;
  responsable_implementacion: string;
  semaforo: string;
}

function riesgoVacio(): RiesgoForm {
  return {
    codigo: "", actividad_tratamiento: "", area_departamento: "",
    cat_especiales_gran_escala: "", obs_sistematica_publica: "", trat_automatizado: "",
    activos_relacionados: "", base_legal: "", articulo_ley: "",
    amenazas: "", vulnerabilidades: "", medidas_implementadas: "",
    probabilidad: "", impacto: "",
    requiere_eipd: "", medidas_implementar: "",
    prob_residual: "", imp_residual: "", responsable_implementacion: "", semaforo: "",
  };
}

interface CambiosCampoRiesgo {
  actividad_riesgo_id: string;
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  version_cambio: number;
}

export default function RiesgosClient({
  matrices,
  nombreEmpresa,
  ratActividades,
  soloLectura,
  proEfectivo,
  cambiosCampoRiesgo,
  planes = [],
}: {
  matrices: MatrizVersion[];
  nombreEmpresa: string;
  ratActividades?: { nombre_actividad: string | null; base_licitud: string | null; articulo_lopdp: string | null; activo_informacion: string | null; medidas_seguridad: string | null; perfiles_automatizados: boolean | null }[];
  soloLectura?: boolean;
  proEfectivo?: boolean;
  cambiosCampoRiesgo?: CambiosCampoRiesgo[];
  planes?: { id: string; actividad_origen_id: string | null; titulo: string }[];
}) {
  const router = useRouter();
  const [isExporting, startExport] = useTransition();
  const [isPending, startTransition] = useTransition();
  const [modal, setModal] = useState<"crear" | null>(null);
  const [riesgos, setRiesgos] = useState<RiesgoForm[]>([riesgoVacio()]);
  const [planesCrear, setPlanesCrear] = useState<{ enabled: boolean; titulo: string; responsable: string; departamento: string; actividad_nombre: string; actividad_realizar: string; fecha_inicio: string; fecha_fin: string }[]>([{ enabled: false, titulo: "", responsable: "", departamento: "", actividad_nombre: "", actividad_realizar: "", fecha_inicio: "", fecha_fin: "" }]);
  const [formError, setFormError] = useState("");
  const [fromUpload, setFromUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mostrarConfirmIA, setMostrarConfirmIA] = useState(false);
  const [analizandoIA, setAnalizandoIA] = useState(false);
  const [resultadoIA, setResultadoIA] = useState<{
    hallazgos: any[];
    resumen: string;
    riesgosCriticos: number;
    score: number | null;
    costo: string;
  } | null>(null);
  const [errorIA, setErrorIA] = useState<string | null>(null);
  const [crearPlanParaActividad, setCrearPlanParaActividad] = useState<{ id: string; nombre: string } | null>(null);
  const [mostrarAgregarRiesgo, setMostrarAgregarRiesgo] = useState(false);

  function getCambiosParaCelda(actividadId: string, campo: string) {
    if (!cambiosCampoRiesgo) return undefined;
    return cambiosCampoRiesgo
      .filter((c) => c.actividad_riesgo_id === actividadId && c.campo === campo)
      .map((c) => ({ version_cambio: c.version_cambio, valor_anterior: c.valor_anterior, valor_nuevo: c.valor_nuevo }));
  }

  async function handleConfirmarIA() {
    const actual = matrices[0];
    if (!actual) return;
    setAnalizandoIA(true);
    setErrorIA(null);
    try {
      const res = await analizarMatrizConIA(actual.id);
      setMostrarConfirmIA(false);
      setResultadoIA(res);
    } catch (e: any) {
      setMostrarConfirmIA(false);
      setErrorIA(e.message ?? "Error al analizar con IA");
    } finally {
      setAnalizandoIA(false);
    }
  }

  function handleExportPdf() {
    if (matrices.length === 0) return;
    const actual = matrices[0];
    startExport(async () => {
      try {
        const { exportarMatrizPdf } = await import("@/lib/export-pdf");
        await exportarMatrizPdf({
          nombreEmpresa,
          version: actual.version,
          actividades: actual.actividades_riesgo,
        });
      } catch (e: any) {
        alert("Error al exportar PDF: " + e.message);
      }
    });
  }

  function handleExportExcel() {
    if (matrices.length === 0) return;
    const actual = matrices[0];
    startExport(async () => {
      try {
        const { exportarMatrizXlsx } = await import("@/lib/export-excel");
        await exportarMatrizXlsx({
          nombreEmpresa,
          version: actual.version,
          actividades: actual.actividades_riesgo,
        });
      } catch (e: any) {
        alert("Error al exportar Excel: " + e.message);
      }
    });
  }

  function updateRiesgo(idx: number, field: keyof RiesgoForm, val: string) {
    setRiesgos((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }

  function removeRiesgo(idx: number) {
    setRiesgos((prev) => prev.filter((_, i) => i !== idx));
    setPlanesCrear((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSelectRatActividad(idx: number, actName: string) {
    const rat = ratActividades?.find((a) => a.nombre_actividad === actName);
    if (!rat) return;
    setRiesgos((prev) => prev.map((r, i) => i === idx ? {
      ...r,
      actividad_tratamiento: rat.nombre_actividad ?? "",
    } : r));
  }

  function handleGuardar() {
    if (riesgos.length === 0) { setFormError("Añade al menos un riesgo"); return; }
    const sinActividad = riesgos.some((r) => !r.actividad_tratamiento.trim());
    if (sinActividad) { setFormError("Cada riesgo necesita una actividad de tratamiento"); return; }
    setFormError("");
    startTransition(async () => {
      try {
        const datos = riesgos.map((r) => {
          const prob = parseInt(r.probabilidad) || null;
          const imp = parseInt(r.impacto) || null;
          const probR = parseInt(r.prob_residual) || null;
          const impR = parseInt(r.imp_residual) || null;
          return {
            codigo: r.codigo || null,
            actividad_tratamiento: r.actividad_tratamiento || null,
            area_departamento: r.area_departamento || null,
            cat_especiales_gran_escala: r.cat_especiales_gran_escala === "si" ? true : r.cat_especiales_gran_escala === "no" ? false : null,
            obs_sistematica_publica: r.obs_sistematica_publica === "si" ? true : r.obs_sistematica_publica === "no" ? false : null,
            trat_automatizado: r.trat_automatizado === "si" ? true : r.trat_automatizado === "no" ? false : null,
            activos_relacionados: r.activos_relacionados || null,
            base_legal: r.base_legal || null,
            articulo_ley: r.articulo_ley || null,
            amenazas: r.amenazas || null,
            vulnerabilidades: r.vulnerabilidades || null,
            medidas_implementadas: r.medidas_implementadas || null,
            probabilidad: prob,
            impacto: imp,
            nivel_riesgo: prob && imp ? calcularNivel(prob, imp) : null,
            requiere_eipd: r.requiere_eipd === "si" ? true : r.requiere_eipd === "no" ? false : null,
            medidas_implementar: r.medidas_implementar || null,
            prob_residual: probR,
            imp_residual: impR,
            nivel_riesgo_residual: probR && impR ? calcularNivel(probR, impR) : null,
            responsable_implementacion: r.responsable_implementacion || null,
            semaforo: (() => {
              const nivel = prob && imp ? calcularNivel(prob, imp) : "";
              if (nivel === "critico" || nivel === "alto") return "rojo";
              if (nivel === "medio") return "amarillo";
              if (nivel === "bajo" || nivel === "muy_bajo") return "verde";
              return null;
            })(),
          };
        });
        const result = await crearMatrizCompleta(datos);

        if (result) {
          const planPromises: Promise<void>[] = [];
          for (let i = 0; i < result.actividadIds.length; i++) {
            const plan = planesCrear[i];
            if (plan?.enabled && plan.titulo.trim()) {
              planPromises.push(
                crearPlanUsuario({
                  tipo: "riesgos",
                  actividad_origen_id: result.actividadIds[i],
                  titulo: plan.titulo.trim(),
                  responsable: plan.responsable.trim() || undefined,
                  departamento: plan.departamento.trim() || undefined,
                  actividad_nombre: plan.actividad_nombre.trim() || riesgos[i]?.actividad_tratamiento || undefined,
                  actividad_realizar: plan.actividad_realizar.trim() || undefined,
                  fecha_inicio: plan.fecha_inicio || undefined,
                  fecha_fin: plan.fecha_fin || undefined,
                }).then(() => {})
              );
            }
          }
          try {
            await Promise.all(planPromises);
          } catch {
            setFormError("La matriz se guardó correctamente, pero hubo un error al crear algunos planes de implementación.");
          }
        }

        setModal(null);
        setRiesgos([riesgoVacio()]);
        setPlanesCrear([{ enabled: false, titulo: "", responsable: "", departamento: "", actividad_nombre: "", actividad_realizar: "", fecha_inicio: "", fecha_fin: "" }]);
        router.refresh();
      } catch (e: any) {
        setFormError(e.message);
      }
    });
  }

  function handleDescargarPlantilla() {
    import("@/lib/riesgos-parser").then(({ generarPlantillaRiesgosTxt }) => {
      const blob = new Blob([generarPlantillaRiesgosTxt()], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla-riesgos.txt";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const texto = await file.text();
      const { parsearTextoRiesgos } = await import("@/lib/riesgos-parser");
      const resultado = parsearTextoRiesgos(texto);
      if (resultado.length > 0) {
        setRiesgos(resultado.map((r) => ({
          codigo: r.codigo ?? "",
          actividad_tratamiento: r.actividad_nombre ?? "",
          area_departamento: r.area_departamento ?? "",
          cat_especiales_gran_escala: r.cat_especiales_gran_escala === true ? "si" : r.cat_especiales_gran_escala === false ? "no" : "",
          obs_sistematica_publica: r.obs_sistematica_publica === true ? "si" : r.obs_sistematica_publica === false ? "no" : "",
          trat_automatizado: r.trat_automatizado === true ? "si" : r.trat_automatizado === false ? "no" : "",
          activos_relacionados: r.activos_relacionados ?? "",
          base_legal: r.base_legal ?? "",
          articulo_ley: r.articulo_ley ?? "",
          amenazas: r.amenazas ?? "",
          vulnerabilidades: r.vulnerabilidades ?? "",
          medidas_implementadas: r.medidas_implementadas ?? "",
          probabilidad: r.probabilidad?.toString() ?? "",
          impacto: r.impacto?.toString() ?? "",
          requiere_eipd: r.requiere_eipd === true ? "si" : r.requiere_eipd === false ? "no" : "",
          medidas_implementar: r.medidas_implementar ?? "",
          prob_residual: r.prob_residual?.toString() ?? "",
          imp_residual: r.imp_residual?.toString() ?? "",
          responsable_implementacion: r.responsable_implementacion ?? "",
          semaforo: r.semaforo ?? "",
        })));
        setPlanesCrear(resultado.map(() => ({ enabled: false, titulo: "", responsable: "", departamento: "", actividad_nombre: "", actividad_realizar: "", fecha_inicio: "", fecha_fin: "" })));
        setFromUpload(true);
        setModal("crear");
      } else {
        setFormError("No se encontraron riesgos en el archivo. Usa el formato de plantilla (Etiqueta: Valor) o CSV.");
      }
    } catch {
      setFormError("Error al leer el archivo");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  // ---------- MODAL ----------
  if (modal === "crear") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Crear Matriz de Riesgos</h1>
          <button onClick={() => { setModal(null); setFormError(""); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        {formError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{formError}</div>}

        {riesgos.map((r, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-bac-gray-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Riesgo {idx + 1}</h3>
              {riesgos.length > 1 && (
                <button onClick={() => removeRiesgo(idx)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Código *</label>
                <input value={r.codigo} onChange={(e) => updateRiesgo(idx, "codigo", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm" placeholder="Ej: RIES-01" />
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Área / Departamento *</label>
                <input value={r.area_departamento} onChange={(e) => updateRiesgo(idx, "area_departamento", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Actividad de Tratamiento *</label>
                {!fromUpload && ratActividades && ratActividades.length > 0 ? (
                  <select value={r.actividad_tratamiento} onChange={(e) => { updateRiesgo(idx, "actividad_tratamiento", e.target.value); handleSelectRatActividad(idx, e.target.value); }} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm">
                    <option value="">Seleccionar actividad RAT...</option>
                    {ratActividades.map((a, ai) => (
                      <option key={ai} value={a.nombre_actividad ?? ""}>{a.nombre_actividad}</option>
                    ))}
                  </select>
                ) : (
                  <input value={r.actividad_tratamiento} onChange={(e) => updateRiesgo(idx, "actividad_tratamiento", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm" placeholder="Nombre de la actividad" />
                )}
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Cat. especiales gran escala?</label>
                <select value={r.cat_especiales_gran_escala} onChange={(e) => updateRiesgo(idx, "cat_especiales_gran_escala", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm">
                  <option value="">—</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Obs. sistemática pública?</label>
                <select value={r.obs_sistematica_publica} onChange={(e) => updateRiesgo(idx, "obs_sistematica_publica", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm">
                  <option value="">—</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Decisiones automatizadas?</label>
                <select value={r.trat_automatizado} onChange={(e) => updateRiesgo(idx, "trat_automatizado", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm">
                  <option value="">—</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Activos Relacionados</label>
                <input value={r.activos_relacionados} onChange={(e) => updateRiesgo(idx, "activos_relacionados", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Base Legal / Normativa</label>
                <input value={r.base_legal} onChange={(e) => updateRiesgo(idx, "base_legal", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Artículo / Ley</label>
                <input value={r.articulo_ley} onChange={(e) => updateRiesgo(idx, "articulo_ley", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm" />
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-bac-gray-text font-medium">Amenazas *</label>
                <textarea value={r.amenazas} onChange={(e) => updateRiesgo(idx, "amenazas", e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm" />
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-bac-gray-text font-medium">Vulnerabilidades *</label>
                <textarea value={r.vulnerabilidades} onChange={(e) => updateRiesgo(idx, "vulnerabilidades", e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm" />
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-bac-gray-text font-medium">Medidas ya implementadas</label>
                <textarea value={r.medidas_implementadas} onChange={(e) => updateRiesgo(idx, "medidas_implementadas", e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Probabilidad (1-5) *</label>
                <select value={r.probabilidad} onChange={(e) => updateRiesgo(idx, "probabilidad", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm">
                  <option value="">—</option>
                  {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Impacto (1-5) *</label>
                <select value={r.impacto} onChange={(e) => updateRiesgo(idx, "impacto", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm">
                  <option value="">—</option>
                  {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                {r.probabilidad && r.impacto && (
                  <div className="flex gap-3 items-center bg-gray-50 rounded-lg p-3 w-full">
                    <span className="text-xs text-bac-gray-text">Riesgo Inherente: <strong>{parseInt(r.probabilidad) * parseInt(r.impacto)}</strong></span>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", NIVEL_COLORS[calcularNivel(parseInt(r.probabilidad), parseInt(r.impacto))] ?? "bg-gray-200")}>
                      {nivelLabel(calcularNivel(parseInt(r.probabilidad), parseInt(r.impacto)))}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Requiere EIPD?</label>
                <select value={r.requiere_eipd} onChange={(e) => updateRiesgo(idx, "requiere_eipd", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm">
                  <option value="">—</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-bac-gray-text font-medium">&nbsp;</label>
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-bac-gray-text font-medium">Medidas a implementar / Plan de mitigación *</label>
                <textarea value={r.medidas_implementar} onChange={(e) => updateRiesgo(idx, "medidas_implementar", e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Prob. Residual (1-5) *</label>
                <select value={r.prob_residual} onChange={(e) => updateRiesgo(idx, "prob_residual", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm">
                  <option value="">—</option>
                  {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Imp. Residual (1-5) *</label>
                <select value={r.imp_residual} onChange={(e) => updateRiesgo(idx, "imp_residual", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm">
                  <option value="">—</option>
                  {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-bac-gray-text font-medium">Responsable *</label>
                <input value={r.responsable_implementacion} onChange={(e) => updateRiesgo(idx, "responsable_implementacion", e.target.value)} className="w-full mt-1 px-3 py-2 border border-bac-gray-border rounded-lg text-sm" />
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-bac-gray-border p-3">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={planesCrear[idx]?.enabled ?? false}
                  onChange={(e) => setPlanesCrear((arr) => arr.map((p, pi) => pi === idx ? { ...p, enabled: e.target.checked } : p))}
                  className="rounded border-bac-gray-border text-bac-red focus:ring-bac-red"
                />
                Crear plan de implementación para este riesgo
              </label>
              {planesCrear[idx]?.enabled && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-bac-gray-text">Título del plan *</label>
                    <input
                      value={planesCrear[idx].titulo}
                      onChange={(e) => setPlanesCrear((arr) => arr.map((p, pi) => pi === idx ? { ...p, titulo: e.target.value } : p))}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-bac-gray-border rounded-lg focus:outline-none focus:ring-1 focus:ring-bac-red"
                      placeholder="Título del plan"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-bac-gray-text">Responsable</label>
                    <input
                      value={planesCrear[idx].responsable}
                      onChange={(e) => setPlanesCrear((arr) => arr.map((p, pi) => pi === idx ? { ...p, responsable: e.target.value } : p))}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-bac-gray-border rounded-lg focus:outline-none focus:ring-1 focus:ring-bac-red"
                      placeholder="Nombre del responsable"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-bac-gray-text">Departamento</label>
                    <input
                      value={planesCrear[idx].departamento}
                      onChange={(e) => setPlanesCrear((arr) => arr.map((p, pi) => pi === idx ? { ...p, departamento: e.target.value } : p))}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-bac-gray-border rounded-lg focus:outline-none focus:ring-1 focus:ring-bac-red"
                      placeholder="Ej: Talento humano"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-bac-gray-text">Nombre de la actividad</label>
                    <input
                      value={planesCrear[idx].actividad_nombre}
                      onChange={(e) => setPlanesCrear((arr) => arr.map((p, pi) => pi === idx ? { ...p, actividad_nombre: e.target.value } : p))}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-bac-gray-border rounded-lg focus:outline-none focus:ring-1 focus:ring-bac-red"
                      placeholder="Nombre de la actividad"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] text-bac-gray-text">Actividad a realizar</label>
                    <input
                      value={planesCrear[idx].actividad_realizar}
                      onChange={(e) => setPlanesCrear((arr) => arr.map((p, pi) => pi === idx ? { ...p, actividad_realizar: e.target.value } : p))}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-bac-gray-border rounded-lg focus:outline-none focus:ring-1 focus:ring-bac-red"
                      placeholder="Describa el plan o implementación"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-bac-gray-text">Fecha inicio</label>
                    <DateInput
                      value={planesCrear[idx].fecha_inicio}
                      onChange={(v) => setPlanesCrear((arr) => arr.map((p, pi) => pi === idx ? { ...p, fecha_inicio: v } : p))}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-bac-gray-border rounded-lg focus:outline-none focus:ring-1 focus:ring-bac-red"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-bac-gray-text">Fecha fin</label>
                    <DateInput
                      value={planesCrear[idx].fecha_fin}
                      onChange={(v) => setPlanesCrear((arr) => arr.map((p, pi) => pi === idx ? { ...p, fecha_fin: v } : p))}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-bac-gray-border rounded-lg focus:outline-none focus:ring-1 focus:ring-bac-red"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        <div className="flex gap-3">
          <button onClick={() => { setRiesgos((p) => [...p, riesgoVacio()]); setPlanesCrear((p) => [...p, { enabled: false, titulo: "", responsable: "", departamento: "", actividad_nombre: "", actividad_realizar: "", fecha_inicio: "", fecha_fin: "" }]); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt transition">
            <Plus className="w-4 h-4" /> Añadir riesgo
          </button>
          <div className="flex-1" />
          <button onClick={() => { setModal(null); setFormError(""); }} className="px-4 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt transition">
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={isPending} className="px-6 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark transition disabled:opacity-60">
            {isPending ? "Guardando..." : "Guardar Matriz"}
          </button>
        </div>
      </div>
    );
  }

  // ---------- EMPTY STATE ----------
  if (matrices.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Matriz de Riesgos</h1>
            <p className="text-sm text-bac-gray-text mt-1">Evaluación de riesgos de tratamiento de datos</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleDescargarPlantilla} className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt transition">
              <Download className="w-4 h-4" />
              Plantilla
            </button>
            {!soloLectura && (
              <>
                <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt transition cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Subir Matriz
                  <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
                </label>
                <button
                  onClick={() => { setRiesgos([riesgoVacio()]); setPlanesCrear([{ enabled: false, titulo: "", responsable: "", departamento: "", actividad_nombre: "", actividad_realizar: "", fecha_inicio: "", fecha_fin: "" }]); setFormError(""); setFromUpload(false); setModal("crear"); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark transition"
                >
                  <Plus className="w-4 h-4" />
                  Crear Matriz
                </button>
              </>
            )}
          </div>
        </div>
        {formError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{formError}</div>}
        <div className="bg-white rounded-xl border border-bac-gray-border p-12 text-center">
          <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Sin matriz de riesgos</h3>
          <p className="mt-2 text-sm text-bac-gray-text max-w-md mx-auto">
            {soloLectura ? "Tu consultor BAC puede crear la matriz desde la plataforma admin." : "Crea o sube tu matriz de riesgos. También tu consultor BAC puede crearla desde la plataforma admin."}
          </p>
        </div>
      </div>
    );
  }

  // ---------- LIST VIEW ----------
  const actual = matrices[0];
  const actividades = actual.actividades_riesgo ?? [];

  const resumen = {
    critico: actividades.filter((a) => a.nivel_riesgo?.toLowerCase() === "critico").length,
    alto: actividades.filter((a) => a.nivel_riesgo?.toLowerCase() === "alto").length,
    medio: actividades.filter((a) => a.nivel_riesgo?.toLowerCase() === "medio").length,
    bajo: actividades.filter((a) => a.nivel_riesgo?.toLowerCase() === "bajo").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Matriz de Riesgos</h1>
          <p className="text-sm text-bac-gray-text mt-1">Evaluación de riesgos de tratamiento de datos</p>
        </div>
        <div className="flex gap-2">
          {!soloLectura && (
            <>
              <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt transition cursor-pointer">
                <Upload className="w-4 h-4" />
                Subir
                <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
              </label>
              <button
                onClick={() => { setRiesgos([riesgoVacio()]); setPlanesCrear([{ enabled: false, titulo: "", responsable: "", departamento: "", actividad_nombre: "", actividad_realizar: "", fecha_inicio: "", fecha_fin: "" }]); setFormError(""); setFromUpload(false); setModal("crear"); }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark transition"
              >
                <Plus className="w-4 h-4" />
                Crear
              </button>
            </>
          )}
          {proEfectivo && matrices.length > 0 && (
            <BotonAnalisisIA tipo="riesgos" onClick={() => setMostrarConfirmIA(true)} />
          )}
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt disabled:opacity-60 transition"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt disabled:opacity-60 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          {!soloLectura && matrices.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm("¿Eliminar toda la matriz de riesgos? Esta acción no se puede deshacer.")) return;
                try {
                  await eliminarMatrizRiesgos(actual.id);
                  router.refresh();
                } catch (err: any) {
                  alert(err.message ?? "Error al eliminar la matriz.");
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar matriz
            </button>
          )}
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          ["Crítico", resumen.critico, "bg-bac-riesgo-critico"],
          ["Alto", resumen.alto, "bg-bac-riesgo-alto"],
          ["Medio", resumen.medio, "bg-bac-riesgo-medio"],
          ["Bajo", resumen.bajo, "bg-bac-riesgo-bajo"],
        ] as const).map(([label, count, color]) => (
          <div key={label} className="bg-white rounded-xl border border-bac-gray-border p-3 flex items-center gap-3">
            <div className={cn("w-3 h-3 rounded-full", color)} />
            <div>
              <p className="text-lg font-bold">{count}</p>
              <p className="text-xs text-bac-gray-text">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-bac-gray-border overflow-hidden">
        <div className="p-4 border-b border-bac-gray-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-bac-red" />
            <span className="font-medium text-sm">{actividades.length} riesgos identificados</span>
          </div>
          <span className="text-xs text-bac-gray-text">Versión {actual.version} — {formatearFecha(actual.created_at)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-white text-xs font-medium" style={{ backgroundColor: `#${GRUPO_HEX["Tratamiento de Datos Personales"]}` }} />
                {GRUPOS_RIESGO.map((g) => (
                  <th key={g.grupo} colSpan={g.columnas.length} className="px-3 py-2 text-white text-xs font-bold uppercase tracking-wide text-center border-l border-white/20" style={{ backgroundColor: `#${GRUPO_HEX[g.grupo] ?? "1E3A8A"}` }}>
                    {g.grupo}
                  </th>
                ))}
                <th className="px-3 py-2 text-white text-xs font-bold uppercase tracking-wide text-center" style={{ backgroundColor: "#7C3AED" }}>Plan</th>
                {!soloLectura && <th className="px-2 py-2" style={{ backgroundColor: `#${GRUPO_HEX["Plan de Mitigación / Riesgo Residual"]}` }} />}
              </tr>
              <tr className="bg-bac-gray-alt">
                <th className="text-left px-3 py-2 font-medium text-bac-gray-text text-xs whitespace-nowrap">#</th>
                {COLUMNAS_RIESGO.map((col) => (
                  <th key={col.key} className="text-left px-3 py-2 font-medium text-bac-gray-text text-xs whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
                <th className="text-left px-3 py-2 font-medium text-bac-gray-text text-xs whitespace-nowrap">Plan</th>
                {!soloLectura && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {actividades.map((act, i) => (
                <tr key={act.id} className="border-b border-bac-gray-border last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-bac-gray-text">{i + 1}</td>
                  {COLUMNAS_RIESGO.map((col) => {
                    const isReadOnly = READ_ONLY_RIESGO_FIELDS.has(col.key);
                    const esNivel = col.key === "nivel_riesgo" || col.key === "nivel_riesgo_residual";
                    const esRiesgoNum = col.key === "riesgo_inherente" || col.key === "riesgo_residual";
                    const nivelRaw = esRiesgoNum
                      ? (col.key === "riesgo_inherente" ? act.nivel_riesgo : act.nivel_riesgo_residual)
                      : esNivel ? String(act[col.key] ?? "") : null;
                    const nivelNorm = normalizarNivel(nivelRaw);
                    const hex = nivelNorm ? NIVEL_HEX[nivelNorm] : null;

                    if (isReadOnly) {
                      return (
                        <td key={col.key} className="px-3 py-2.5">
                          {hex ? (
                            <span
                              className="inline-flex min-w-[2.5rem] justify-center rounded px-2 py-0.5 text-xs font-semibold text-white"
                              style={{ backgroundColor: `#${hex}` }}
                            >
                              {esNivel && nivelNorm ? nivelLabel(nivelNorm) : celdaRiesgo(act[col.key])}
                            </span>
                          ) : (
                            <span className="text-bac-gray-text text-xs">{esNivel && nivelNorm ? nivelLabel(nivelNorm) : celdaRiesgo(act[col.key])}</span>
                          )}
                        </td>
                      );
                    }

                    if (!soloLectura) {
                      return (
                        <td key={col.key} className="px-3 py-1 text-bac-gray-text whitespace-pre-line text-xs" style={{ minWidth: "100px" }}>
                          <EditableCell
                            value={act[col.key]}
                            field={col.key}
                            onSave={async (campo, valor) => {
                              await actualizarActividadRiesgo(act.id, campo, valor);
                              router.refresh();
                            }}
                            cambios={getCambiosParaCelda(act.id, col.key)}
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={col.key} className="px-3 py-2.5 text-bac-gray-text whitespace-pre-line text-xs" style={{ minWidth: "120px" }}>
                        {celdaRiesgo(act[col.key])}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1" style={{ minWidth: "80px" }}>
                    {(() => {
                      const vinculados = planes.filter((p) => p.actividad_origen_id === act.id);
                      return vinculados.length > 0 ? (
                        <div className="space-y-0.5">
                          {vinculados.map((p) => (
                            <span key={p.id} className="block text-[11px] text-bac-red font-medium truncate max-w-[100px]" title={p.titulo}>{p.titulo}</span>
                          ))}
                        </div>
                      ) : !soloLectura ? (
                        <button
                          onClick={() => setCrearPlanParaActividad({ id: act.id, nombre: act.actividad_tratamiento ?? `Riesgo` })}
                          className="inline-flex items-center gap-0.5 rounded border border-dashed border-bac-gray-border px-1.5 py-0.5 text-[10px] text-bac-gray-text hover:border-bac-red hover:text-bac-red"
                        >
                          <Plus className="h-2.5 w-2.5" /> Plan
                        </button>
                      ) : (
                        <span className="text-[10px] text-bac-gray-text">—</span>
                      );
                    })()}
                  </td>
                  {!soloLectura && (
                    <td className="px-2 py-1">
                      <button
                        onClick={async () => {
                          if (!confirm("¿Eliminar este riesgo?")) return;
                          await eliminarActividadRiesgo(act.id);
                          router.refresh();
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Eliminar riesgo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {actividades.length === 0 && (
                <tr>
                  <td colSpan={COLUMNAS_RIESGO.length + 1 + (!soloLectura ? 1 : 0)} className="px-4 py-8 text-center text-bac-gray-text">
                    Sin riesgos en esta versión
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {!soloLectura && (
        <button
          onClick={() => setMostrarAgregarRiesgo(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-bac-gray-border px-3 py-1.5 text-xs font-medium text-bac-gray-text hover:border-bac-red hover:text-bac-red"
        >
          <Plus className="h-3.5 w-3.5" /> Añadir riesgo
        </button>
      )}

      {errorIA && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorIA}
        </div>
      )}

      {mostrarConfirmIA && (
        <ConfirmacionIAModal
          tipo="riesgos"
          analizando={analizandoIA}
          onConfirmar={handleConfirmarIA}
          onClose={() => { if (!analizandoIA) setMostrarConfirmIA(false); }}
        />
      )}

      {resultadoIA && (
        <ResultadoIAMatrizModal
          hallazgos={resultadoIA.hallazgos}
          resumen={resultadoIA.resumen}
          riesgosCriticos={resultadoIA.riesgosCriticos}
          score={resultadoIA.score}
          onClose={() => setResultadoIA(null)}
        />
      )}

      {crearPlanParaActividad && (
        <CrearPlanRiesgoModal
          preselectedActivityId={crearPlanParaActividad.id}
          actividades={
            matrices[0]
              ? matrices[0].actividades_riesgo.map((a: ActividadRiesgo, i: number) => ({ id: a.id, index: i + 1, nombre: a.actividad_tratamiento ?? `Riesgo ${i + 1}` }))
              : []
          }
          onClose={() => setCrearPlanParaActividad(null)}
        />
      )}

      {mostrarAgregarRiesgo && matrices[0] && (
        <AgregarActividadRiesgoModalUser
          matrizId={matrices[0].id}
          onClose={() => setMostrarAgregarRiesgo(false)}
        />
      )}
    </div>
  );
}

function CrearPlanRiesgoModal({
  preselectedActivityId,
  actividades,
  onClose,
}: {
  preselectedActivityId: string;
  actividades: { id: string; index: number; nombre: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [titulo, setTitulo] = useState("");
  const [responsable, setResponsable] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [actividadNombre, setActividadNombre] = useState("");
  const [actividadRealizar, setActividadRealizar] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [actividadOrigenId, setActividadOrigenId] = useState(preselectedActivityId);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) { setError("El título es obligatorio."); return; }
    setError(null);
    startTransition(async () => {
      try {
        await crearPlanUsuario({
          tipo: "riesgos",
          actividad_origen_id: actividadOrigenId || undefined,
          titulo: titulo.trim(),
          responsable: responsable.trim() || undefined,
          departamento: departamento.trim() || undefined,
          actividad_nombre: actividadNombre.trim() || undefined,
          actividad_realizar: actividadRealizar.trim() || undefined,
          fecha_inicio: fechaInicio || undefined,
          fecha_fin: fechaFin || undefined,
        });
        router.refresh();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear el plan.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Crear plan — Riesgos</h3>
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
              <input value={responsable} onChange={(e) => setResponsable(e.target.value)} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm" placeholder="Nombre del responsable" />
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
            <textarea value={actividadRealizar} onChange={(e) => setActividadRealizar(e.target.value)} className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm" rows={3} placeholder="Describa el plan o implementación" />
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
            <button type="button" onClick={onClose} className="rounded-lg border border-bac-gray-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={isPending} className="rounded-lg bg-bac-red px-4 py-2 text-sm font-medium text-white hover:bg-bac-red-dark disabled:opacity-60">
              {isPending ? "Creando..." : "Crear plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AgregarActividadRiesgoModalUser({
  matrizId,
  onClose,
}: {
  matrizId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    area_departamento: "",
    actividad_tratamiento: "",
    activos_relacionados: "",
    base_legal: "",
    articulo_ley: "",
    amenazas: "",
    vulnerabilidades: "",
    medidas_implementadas: "",
    medidas_implementar: "",
    responsable_implementacion: "",
  });
  const [planEnabled, setPlanEnabled] = useState(false);
  const [plan, setPlan] = useState({ titulo: "", responsable: "", departamento: "", actividad_nombre: "", actividad_realizar: "", fecha_inicio: "", fecha_fin: "" });

  const camposObligatorios = [
    { key: "actividad_tratamiento", label: "Actividad de Tratamiento", required: true },
    { key: "area_departamento", label: "Área / Departamento", required: true },
    { key: "base_legal", label: "Base Legal / Normativa", required: true },
    { key: "amenazas", label: "Amenazas Identificadas", required: true },
  ];

  const camposOpcionales = [
    { key: "activos_relacionados", label: "Activos de Información Relacionados" },
    { key: "articulo_ley", label: "Artículo / Ley Específica" },
    { key: "vulnerabilidades", label: "Vulnerabilidades" },
    { key: "medidas_implementadas", label: "Medidas ya Implementadas" },
    { key: "medidas_implementar", label: "Medidas a Implementar (Controles nuevos)" },
    { key: "responsable_implementacion", label: "Responsable Implementación" },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.actividad_tratamiento.trim()) return;
    setSaving(true);
    try {
      const newId = await agregarActividadRiesgo(matrizId, form);
      if (planEnabled && plan.titulo.trim() && newId) {
        await crearPlanUsuario({
          tipo: "riesgos",
          actividad_origen_id: newId,
          titulo: plan.titulo,
          responsable: plan.responsable || undefined,
          departamento: plan.departamento || undefined,
          actividad_nombre: plan.actividad_nombre || undefined,
          actividad_realizar: plan.actividad_realizar || undefined,
          fecha_inicio: plan.fecha_inicio || undefined,
          fecha_fin: plan.fecha_fin || undefined,
        });
      }
      router.refresh();
      onClose();
    } catch (err: any) {
      alert(err.message ?? "Error al crear riesgo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Nuevo riesgo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-xs text-bac-gray-text">
          Complete los campos obligatorios y opcionalmente los adicionales. El riesgo se añadirá al final de la matriz.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bac-red">Campos obligatorios</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {camposObligatorios.map((c) => (
                <div key={c.key} className={c.key === "actividad_tratamiento" ? "sm:col-span-2" : ""}>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {c.label} <span className="text-red-500">*</span>
                  </label>
                  <input
                    className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    value={form[c.key as keyof typeof form]}
                    onChange={(e) => setForm((p) => ({ ...p, [c.key]: e.target.value }))}
                    placeholder={c.label}
                    required
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Campos opcionales</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {camposOpcionales.map((c) => (
                <div key={c.key}>
                  <label className="mb-1 block text-xs font-medium text-gray-700">{c.label}</label>
                  <input
                    className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    value={form[c.key as keyof typeof form]}
                    onChange={(e) => setForm((p) => ({ ...p, [c.key]: e.target.value }))}
                    placeholder={c.label}
                  />
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-bac-gray-text italic">
            Los campos de probabilidad, impacto, nivel de riesgo y EIPD se calculan automáticamente después de crear el riesgo.
          </p>

          <div className="border-t border-bac-gray-border pt-4">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" checked={planEnabled} onChange={(e) => setPlanEnabled(e.target.checked)} className="rounded border-gray-300" />
              Crear plan de implementación para este riesgo
            </label>
            {planEnabled && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-lg border border-bac-gray-border p-3 bg-gray-50">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-700">Título del plan <span className="text-red-500">*</span></label>
                  <input className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/30" value={plan.titulo} onChange={(e) => setPlan((p) => ({ ...p, titulo: e.target.value }))} placeholder="Título del plan" required />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Responsable</label>
                  <input className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/30" value={plan.responsable} onChange={(e) => setPlan((p) => ({ ...p, responsable: e.target.value }))} placeholder="Responsable" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Departamento</label>
                  <input className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/30" value={plan.departamento} onChange={(e) => setPlan((p) => ({ ...p, departamento: e.target.value }))} placeholder="Departamento" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Actividad a realizar</label>
                  <input className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/30" value={plan.actividad_realizar} onChange={(e) => setPlan((p) => ({ ...p, actividad_realizar: e.target.value }))} placeholder="Actividad a realizar" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Nombre de actividad</label>
                  <input className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/30" value={plan.actividad_nombre} onChange={(e) => setPlan((p) => ({ ...p, actividad_nombre: e.target.value }))} placeholder="Nombre de actividad" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Fecha inicio</label>
                  <DateInput className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/30" value={plan.fecha_inicio} onChange={(v) => setPlan((p) => ({ ...p, fecha_inicio: v }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Fecha fin</label>
                  <DateInput className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/30" value={plan.fecha_fin} onChange={(v) => setPlan((p) => ({ ...p, fecha_fin: v }))} />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-bac-gray-border pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-bac-gray-border px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !form.actividad_tratamiento.trim() || (planEnabled && !plan.titulo.trim())} className="rounded-lg bg-bac-red px-4 py-2 text-xs font-medium text-white hover:bg-bac-red-dark disabled:opacity-50">
              {saving ? "Creando..." : "Crear riesgo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
