"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, Download, ChevronDown, ChevronUp, Plus, Upload, FileSpreadsheet, X, Trash2, Paperclip, FolderOpen, Pencil, RefreshCw } from "lucide-react";
import { formatearFecha, cn } from "@/lib/utils";
import { DateInput } from "@/components/DateInput";
import type { RatVersion, ActividadRat } from "@/lib/types";
import { COLUMNAS_RAT } from "@/lib/types";
import { crearRatCompleto, actualizarActividadRat, agregarActividadRat, eliminarActividadRat, eliminarVersionRat, subirDocRatEnCarpeta, renombrarDocCarpeta, eliminarDocCarpeta, reemplazarDocCarpeta, crearPlanUsuario } from "@/lib/dashboard/user-actions";
import { analizarRatConIA } from "@/lib/dashboard/ia-actions";
import { EditableCell } from "./EditableCell";
import { BotonAnalisisIA, ConfirmacionIAModal, ResultadoIABrechasModal } from "./AnalisisIAModal";

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

function celdaRat(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Sí" : "No";
  if (Array.isArray(val)) return val.length > 0 ? val.join(", ") : "—";
  return String(val);
}

const CAMPOS_ACTIVIDAD = COLUMNAS_RAT.map((c) => c.key).filter((k) => k !== "id" && k !== "rat_version_id");

function actividadVacia(): Record<string, string> {
  const obj: Record<string, string> = {};
  CAMPOS_ACTIVIDAD.forEach((k) => { obj[k] = ""; });
  return obj;
}

interface CarpetaEjemploSimple { id: string; nombre: string; }
interface CarpetaConDocs { id: string; nombre: string; documentos: { id: string; nombre_archivo: string; url_storage: string }[]; }
interface DocActividadItem { id: string; nombre_archivo: string; url_storage: string; actividad_rat_id: string; version?: number; doc_original_id?: string | null; }

function DocCell({
  actividadId,
  actividadNombre,
  carpetasEjemplo,
  carpetas = [],
  soloLectura,
  docs,
}: {
  actividadId: string;
  actividadNombre: string;
  carpetasEjemplo: CarpetaEjemploSimple[];
  carpetas?: CarpetaConDocs[];
  soloLectura?: boolean;
  docs: DocActividadItem[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<"local" | "cliente">("local");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCarpeta, setSelectedCarpeta] = useState("");
  const [docName, setDocName] = useState("");
  const [editingDoc, setEditingDoc] = useState<{ id: string; nombre: string } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setDocName(file.name);
    setPickerMode("local");
    setShowPicker(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  function openPickerBrowse() {
    setSelectedFile(null);
    setDocName("");
    setSelectedCarpeta("");
    setPickerMode("local");
    setShowPicker(true);
  }

  async function handleConfirmUpload() {
    if (!selectedFile || !selectedCarpeta) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      if (docName.trim() && docName.trim() !== selectedFile.name) {
        fd.append("nombreArchivo", docName.trim());
      }
      await subirDocRatEnCarpeta(actividadId, actividadNombre, selectedCarpeta, fd);
      setShowPicker(false);
      setSelectedFile(null);
      setSelectedCarpeta("");
      setDocName("");
      router.refresh();
    } catch (err: any) {
      alert(err.message ?? "Error al subir archivo");
    } finally {
      setUploading(false);
    }
  }

  async function handleSelectFromFolder(doc: { id: string; nombre_archivo: string; url_storage: string }) {
    setUploading(true);
    try {
      const resp = await fetch(doc.url_storage);
      const blob = await resp.blob();
      const file = new File([blob], doc.nombre_archivo, { type: blob.type });
      const fd = new FormData();
      fd.append("file", file);
      fd.append("nombreArchivo", doc.nombre_archivo);
      await subirDocRatEnCarpeta(actividadId, actividadNombre, selectedCarpeta || carpetas[0]?.nombre || "General", fd);
      setShowPicker(false);
      router.refresh();
    } catch (err: any) {
      alert(err.message ?? "Error al vincular archivo");
    } finally {
      setUploading(false);
    }
  }

  async function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !replacingDocId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await reemplazarDocCarpeta(replacingDocId, fd);
      setReplacingDocId(null);
      router.refresh();
    } catch (err: any) {
      alert(err.message ?? "Error al reemplazar");
    } finally {
      setUploading(false);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  }

  async function handleRename() {
    if (!editingDoc || !editingDoc.nombre.trim()) return;
    setRenaming(true);
    try {
      await renombrarDocCarpeta(editingDoc.id, editingDoc.nombre.trim());
      setEditingDoc(null);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRenaming(false);
    }
  }

  async function handleDeleteAttached(docId: string) {
    if (!confirm("¿Eliminar este documento?")) return;
    try {
      await eliminarDocCarpeta(docId);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }

  const grouped = (() => {
    const groups = new Map<string, DocActividadItem[]>();
    for (const d of docs) {
      const key = d.doc_original_id ?? d.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }
    const result: { latest: DocActividadItem; previous: DocActividadItem[] }[] = [];
    for (const [, group] of groups) {
      const sorted = group.sort((a, b) => ((b.version ?? 1) - (a.version ?? 1)));
      result.push({ latest: sorted[0], previous: sorted.slice(1) });
    }
    return result;
  })();

  return (
    <div className="flex flex-col gap-1">
      <input ref={replaceRef} type="file" className="hidden" onChange={handleReplaceFile} />
      {grouped.map(({ latest: d }) => (
        <div key={d.id} className="flex items-center gap-1 text-[10px]">
          <FileText className="h-3 w-3 text-bac-gray-text shrink-0" />
          <span className="text-gray-700 truncate max-w-[80px]" title={d.nombre_archivo}>{d.nombre_archivo}</span>
          {!soloLectura && (
            <>
              <button
                onClick={() => setEditingDoc({ id: d.id, nombre: d.nombre_archivo })}
                className="p-0.5 text-gray-400 hover:text-bac-red rounded"
                title="Renombrar"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
              <button
                onClick={() => { setReplacingDocId(d.id); replaceRef.current?.click(); }}
                className="p-0.5 text-gray-400 hover:text-blue-600 rounded"
                title="Reemplazar"
              >
                <RefreshCw className="h-2.5 w-2.5" />
              </button>
              <button
                onClick={() => handleDeleteAttached(d.id)}
                className="p-0.5 text-gray-400 hover:text-red-600 rounded"
                title="Eliminar"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </>
          )}
        </div>
      ))}
      {!soloLectura && (
        <button
          onClick={openPickerBrowse}
          className={cn(
            "inline-flex cursor-pointer items-center gap-0.5 rounded border border-dashed border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-500 hover:border-blue-400 hover:text-blue-600",
            uploading && "pointer-events-none opacity-50"
          )}
        >
          <Paperclip className="h-3 w-3" />
          {uploading ? "Subiendo..." : "Adjuntar"}
        </button>
      )}

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowPicker(false); setSelectedFile(null); }}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Adjuntar documento</h3>
              <button onClick={() => { setShowPicker(false); setSelectedFile(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-bac-gray-text">
              Actividad: <span className="font-medium text-gray-700">{actividadNombre}</span>
            </p>

            <div className="mb-3 flex gap-1 border-b border-bac-gray-border pb-2">
              <button
                onClick={() => { setPickerMode("local"); setSelectedCarpeta(""); }}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition",
                  pickerMode === "local" ? "bg-bac-red text-white" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                Archivo local
              </button>
              <button
                onClick={() => { setPickerMode("cliente"); setSelectedCarpeta(""); }}
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium transition",
                  pickerMode === "cliente" ? "bg-blue-600 text-white" : "text-blue-600 hover:bg-blue-50"
                )}
              >
                Carpetas del cliente
              </button>
            </div>

            {pickerMode === "local" && (
              <>
                {!selectedFile ? (
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-bac-red/50">
                    <Upload className="h-6 w-6 text-gray-400" />
                    <span className="text-sm text-gray-600">Seleccionar archivo</span>
                    <input type="file" className="hidden" onChange={handleFileSelect} />
                  </label>
                ) : (
                  <>
                    <p className="mb-1 text-xs text-bac-gray-text">
                      Archivo: <span className="font-medium text-gray-700">{selectedFile.name}</span>
                    </p>
                    <div className="mb-3">
                      <label className="text-xs font-medium text-bac-gray-text">Nombre del documento</label>
                      <input
                        className="mt-1 w-full px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                      />
                    </div>
                    <p className="mb-1 text-xs font-medium text-bac-gray-text">Guardar en carpeta del cliente:</p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {carpetas.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedCarpeta(c.nombre)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                            selectedCarpeta === c.nombre
                              ? "border-bac-red bg-bac-red/5 text-bac-red"
                              : "border-bac-gray-border text-gray-700 hover:bg-bac-gray-alt"
                          )}
                        >
                          <FolderOpen className="h-4 w-4 shrink-0" />
                          {c.nombre}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {pickerMode === "cliente" && (
              <div className="space-y-2 max-h-52 overflow-y-auto rounded-lg border border-blue-200 p-2 bg-blue-50/30">
                {carpetas.length === 0 ? (
                  <p className="text-xs text-bac-gray-text py-4 text-center">No hay carpetas del cliente.</p>
                ) : carpetas.map((c) => (
                  <div key={c.id}>
                    <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <FolderOpen className="h-3.5 w-3.5" /> {c.nombre}
                    </p>
                    {c.documentos.length === 0 ? (
                      <p className="text-[10px] text-gray-400 ml-5">Sin documentos</p>
                    ) : c.documentos.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => handleSelectFromFolder(doc)}
                        disabled={uploading}
                        className="ml-5 mb-0.5 flex w-[calc(100%-1.25rem)] items-center gap-1.5 rounded border border-bac-gray-border px-2 py-1 text-left text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50"
                      >
                        <FileText className="h-3 w-3 shrink-0 text-gray-400" />
                        <span className="truncate">{doc.nombre_archivo}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setShowPicker(false); setSelectedFile(null); }}
                className="rounded-lg border border-bac-gray-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-bac-gray-alt"
              >
                Cancelar
              </button>
              {pickerMode === "local" && selectedFile && (
                <button
                  onClick={handleConfirmUpload}
                  disabled={!selectedCarpeta || uploading}
                  className="rounded-lg bg-bac-red px-3 py-1.5 text-xs font-medium text-white hover:bg-bac-red/90 disabled:opacity-50"
                >
                  {uploading ? "Subiendo..." : "Subir a carpeta"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditingDoc(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Renombrar documento</h3>
              <button onClick={() => setEditingDoc(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              className="w-full px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
              placeholder="Nombre del documento"
              value={editingDoc.nombre}
              onChange={(e) => setEditingDoc({ ...editingDoc, nombre: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditingDoc(null)}
                className="rounded-lg border border-bac-gray-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-bac-gray-alt"
              >
                Cancelar
              </button>
              <button
                onClick={handleRename}
                disabled={renaming || !editingDoc.nombre.trim()}
                className="rounded-lg bg-bac-red px-3 py-1.5 text-xs font-medium text-white hover:bg-bac-red/90 disabled:opacity-50"
              >
                {renaming ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CambiosCampoRat {
  actividad_rat_id: string;
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  version_cambio: number;
  created_at: string;
}

export default function RatClient({
  versiones,
  nombreEmpresa,
  soloLectura,
  proEfectivo,
  carpetasEjemplo = [],
  carpetas = [],
  docsActividades = [],
  cambiosCampoRat = [],
  planes = [],
}: {
  versiones: RatVersion[];
  nombreEmpresa: string;
  soloLectura?: boolean;
  proEfectivo?: boolean;
  carpetasEjemplo?: CarpetaEjemploSimple[];
  carpetas?: CarpetaConDocs[];
  docsActividades?: DocActividadItem[];
  cambiosCampoRat?: CambiosCampoRat[];
  planes?: { id: string; actividad_origen_id: string | null; titulo: string }[];
}) {
  const router = useRouter();

  function getCambiosParaCelda(actividadId: string, campo: string) {
    return cambiosCampoRat
      .filter((c) => c.actividad_rat_id === actividadId && c.campo === campo)
      .sort((a, b) => a.version_cambio - b.version_cambio);
  }
  const [showResponsable, setShowResponsable] = useState(false);
  const [modal, setModal] = useState<"crear" | "subir" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isExporting, startExport] = useTransition();
  const [mostrarConfirmIA, setMostrarConfirmIA] = useState(false);
  const [analizandoIA, setAnalizandoIA] = useState(false);
  const [resultadoIA, setResultadoIA] = useState<{
    brechas: any[];
    resumen: string;
    score: number | null;
    costo: string;
  } | null>(null);
  const [errorIA, setErrorIA] = useState<string | null>(null);
  const [crearPlanParaActividad, setCrearPlanParaActividad] = useState<{ id: string; nombre: string } | null>(null);
  const [mostrarAgregarActividad, setMostrarAgregarActividad] = useState(false);

  // Create form state
  const [resp, setResp] = useState({ nombre: nombreEmpresa, ruc: "", direccion: "", telefono: "", web: "", encargado: "" });
  const [dpd, setDpd] = useState({ nombre: "", direccion: "", correo: "" });
  const [acts, setActs] = useState<Record<string, string>[]>([actividadVacia()]);
  const [archivosAdjuntos, setArchivosAdjuntos] = useState<File[][]>([[]]);
  const [docsFromFolder, setDocsFromFolder] = useState<({ id: string; nombre_archivo: string; url_storage: string } | null)[]>([null]);
  const [adjuntoTabs, setAdjuntoTabs] = useState<("local" | "cliente")[]>(["local"]);
  const [planDrafts, setPlanDrafts] = useState<{ enabled: boolean; titulo: string; responsable: string; departamento: string; actividad_nombre: string; actividad_realizar: string; fecha_inicio: string; fecha_fin: string }[]>([{ enabled: false, titulo: "", responsable: "", departamento: "", actividad_nombre: "", actividad_realizar: "", fecha_inicio: "", fecha_fin: "" }]);
  const [formError, setFormError] = useState("");

  // Upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadResult, setUploadResult] = useState<{ actividades: number; texto: string } | null>(null);

  async function handleConfirmarIA() {
    const actual = versiones[0];
    if (!actual) return;
    setAnalizandoIA(true);
    setErrorIA(null);
    try {
      const res = await analizarRatConIA(actual.id);
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
    if (versiones.length === 0) return;
    const actual = versiones[0];
    startExport(async () => {
      try {
        const { exportarRatPdf } = await import("@/lib/export-pdf");
        await exportarRatPdf({
          nombreEmpresa,
          version: actual.version,
          responsable: actual.datos_responsable,
          dpd: actual.datos_dpd,
          actividades: actual.actividades_rat,
        });
      } catch (e: any) {
        alert("Error al exportar PDF: " + e.message);
      }
    });
  }

  function handleExportExcel() {
    if (versiones.length === 0) return;
    const actual = versiones[0];
    startExport(async () => {
      try {
        const { exportarRatXlsx } = await import("@/lib/export-excel");
        await exportarRatXlsx({
          nombreEmpresa,
          version: actual.version,
          responsable: actual.datos_responsable,
          dpd: actual.datos_dpd,
          actividades: actual.actividades_rat,
        });
      } catch (e: any) {
        alert("Error al exportar Excel: " + e.message);
      }
    });
  }

  function updateAct(idx: number, key: string, value: string) {
    setActs((prev) => prev.map((a, i) => (i === idx ? { ...a, [key]: value } : a)));
  }

  async function handleCrear() {
    if (!resp.nombre.trim()) { setFormError("Nombre de empresa obligatorio"); return; }
    if (acts.every((a) => !a.nombre_actividad?.trim())) { setFormError("Agrega al menos una actividad"); return; }
    setFormError("");
    startTransition(async () => {
      try {
        const actividadesLimpias = acts
          .filter((a) => a.nombre_actividad?.trim())
          .map((a) => ({
            nombre_actividad: a.nombre_actividad || null,
            finalidad: a.finalidad || null,
            categoria_datos: a.categoria_datos ? a.categoria_datos.split(",").map((s: string) => s.trim()) : null,
            categorias_especiales: a.categorias_especiales || null,
            perfiles_automatizados: a.perfiles_automatizados === "si" ? true : a.perfiles_automatizados === "no" ? false : null,
            categorias_titulares: a.categorias_titulares ? a.categorias_titulares.split(",").map((s: string) => s.trim()) : null,
            origen_datos: a.origen_datos || null,
            base_licitud: a.base_licitud || null,
            articulo_lopdp: a.articulo_lopdp || null,
            plazo_conservacion: a.plazo_conservacion || null,
            destinatarios: a.destinatarios || null,
            transferencias_internacionales: a.transferencias_internacionales === "si" ? true : a.transferencias_internacionales === "no" ? false : null,
            medidas_seguridad: a.medidas_seguridad || null,
            almacenamiento: a.almacenamiento || null,
            departamento: a.departamento || null,
            activo_informacion: a.activo_informacion || null,
          }));
        const result = await crearRatCompleto(resp, dpd, actividadesLimpias);

        if (result) {
          const filteredIdxs = acts.map((a, i) => ({ a, i })).filter(({ a }) => a.nombre_actividad?.trim());
          for (let j = 0; j < result.actividadIds.length; j++) {
            const origIdx = filteredIdxs[j]?.i;
            if (origIdx === undefined) continue;
            const files = archivosAdjuntos[origIdx] ?? [];
            for (const file of files) {
              const fd = new FormData();
              fd.append("file", file);
              fd.append("nombreArchivo", file.name);
              await subirDocRatEnCarpeta(
                result.actividadIds[j],
                acts[origIdx].nombre_actividad || `Actividad ${origIdx + 1}`,
                "RAT - Documentos",
                fd
              );
            }
            const folderDoc = docsFromFolder[origIdx];
            if (folderDoc) {
              const docResp = await fetch(folderDoc.url_storage);
              const blob = await docResp.blob();
              const docFile = new File([blob], folderDoc.nombre_archivo, { type: blob.type });
              const fd = new FormData();
              fd.append("file", docFile);
              fd.append("nombreArchivo", folderDoc.nombre_archivo);
              await subirDocRatEnCarpeta(
                result.actividadIds[j],
                acts[origIdx].nombre_actividad || `Actividad ${origIdx + 1}`,
                "RAT - Documentos",
                fd
              );
            }
          }
          const planPromises: Promise<void>[] = [];
          for (let j = 0; j < result.actividadIds.length; j++) {
            const origIdx = filteredIdxs[j]?.i;
            if (origIdx === undefined) continue;
            const plan = planDrafts[origIdx];
            if (plan?.enabled && plan.titulo.trim()) {
              planPromises.push(
                crearPlanUsuario({
                  tipo: "rat",
                  actividad_origen_id: result.actividadIds[j],
                  titulo: plan.titulo.trim(),
                  responsable: plan.responsable.trim() || undefined,
                  departamento: plan.departamento.trim() || undefined,
                  actividad_nombre: plan.actividad_nombre.trim() || acts[origIdx].nombre_actividad || undefined,
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
            // Plans failed but RAT was saved — don't block
          }
        }

        setModal(null);
        setArchivosAdjuntos([[]]);
        setDocsFromFolder([null]);
        setAdjuntoTabs(["local"]);
        setPlanDrafts([{ enabled: false, titulo: "", responsable: "", departamento: "", actividad_nombre: "", actividad_realizar: "", fecha_inicio: "", fecha_fin: "" }]);
        router.refresh();
      } catch (e: any) {
        setFormError(e.message);
      }
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const texto = await file.text();
    const { parsearTextoRat } = await import("@/lib/rat-parser");
    const resultado = parsearTextoRat(texto);
    setResp({
      nombre: resultado.responsable.responsable || nombreEmpresa,
      ruc: resultado.responsable.ruc,
      direccion: resultado.responsable.direccion,
      telefono: resultado.responsable.telefono,
      web: resultado.responsable.web,
      encargado: resultado.responsable.encargado,
    });
    setDpd(resultado.dpd);
    if (resultado.actividades.length > 0) {
      setActs(resultado.actividades.map((a) => ({ ...a })));
      setArchivosAdjuntos(resultado.actividades.map(() => []));
    }
    setUploadResult({ actividades: resultado.actividades.length, texto: `${resultado.actividades.length} actividades extraídas` });
    setModal("crear");
  }

  function handleDescargarPlantilla() {
    import("@/lib/rat-parser").then(({ generarPlantillaRatTxt }) => {
      const blob = new Blob([generarPlantillaRatTxt()], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla-rat.txt";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Empty state
  if (versiones.length === 0 && !modal) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mi RAT</h1>
            <p className="text-sm text-bac-gray-text mt-1">Registro de Actividades de Tratamiento</p>
          </div>
          {!soloLectura && (
            <div className="flex gap-2">
              <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt transition cursor-pointer">
                <Upload className="w-4 h-4" />
                Subir RAT
                <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
              </label>
              <button
                onClick={() => { setActs([actividadVacia()]); setArchivosAdjuntos([[]]); setFormError(""); setModal("crear"); }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark transition"
              >
                <Plus className="w-4 h-4" />
                Crear RAT
              </button>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-bac-gray-border p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Sin RAT registrado</h3>
          <p className="mt-2 text-sm text-bac-gray-text max-w-md mx-auto">
            Crea o sube tu Registro de Actividades de Tratamiento para comenzar con el cumplimiento LOPDP.
          </p>
          <button onClick={handleDescargarPlantilla} className="mt-4 text-sm text-bac-red hover:underline">
            Descargar plantilla de ejemplo (.txt)
          </button>
        </div>
      </div>
    );
  }

  // Create/edit modal
  if (modal === "crear") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {uploadResult ? "Revisar RAT importado" : "Crear nuevo RAT"}
          </h1>
          <button onClick={() => { setModal(null); setUploadResult(null); }} className="p-2 hover:bg-bac-gray-alt rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {uploadResult && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            {uploadResult.texto}. Revisa y completa los datos antes de guardar.
          </div>
        )}

        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{formError}</div>
        )}

        <div className="bg-white rounded-xl border border-bac-gray-border p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-sm mb-3">Responsable de Tratamiento</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {([
                ["nombre", "Nombre empresa *"],
                ["ruc", "RUC"],
                ["direccion", "Dirección"],
                ["telefono", "Teléfono"],
                ["web", "Sitio web"],
                ["encargado", "Encargado de Tratamiento"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs font-medium text-bac-gray-text">{label}</label>
                  <input
                    className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    value={(resp as any)[key]}
                    onChange={(e) => setResp({ ...resp, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-3">Delegado de Protección de Datos (DPD)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {([
                ["nombre", "Nombre del DPD"],
                ["direccion", "Dirección del DPD"],
                ["correo", "Correo del DPD"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs font-medium text-bac-gray-text">{label}</label>
                  <input
                    className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    value={(dpd as any)[key]}
                    onChange={(e) => setDpd({ ...dpd, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Actividades de Tratamiento ({acts.length})</h3>
              <button
                onClick={() => { setActs([...acts, actividadVacia()]); setArchivosAdjuntos((prev) => [...prev, []]); setDocsFromFolder((prev) => [...prev, null]); setAdjuntoTabs((prev) => [...prev, "local"]); setPlanDrafts((prev) => [...prev, { enabled: false, titulo: "", responsable: "", departamento: "", actividad_nombre: "", actividad_realizar: "", fecha_inicio: "", fecha_fin: "" }]); }}
                className="flex items-center gap-1 text-xs font-medium text-bac-red hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Añadir actividad
              </button>
            </div>

            <div className="space-y-4">
              {acts.map((act, idx) => (
                <div key={idx} className="border border-bac-gray-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-bac-gray-text">Actividad {idx + 1}</span>
                    {acts.length > 1 && (
                      <button
                        onClick={() => { setActs(acts.filter((_, i) => i !== idx)); setArchivosAdjuntos((prev) => prev.filter((_, i) => i !== idx)); setDocsFromFolder((prev) => prev.filter((_, i) => i !== idx)); setAdjuntoTabs((prev) => prev.filter((_, i) => i !== idx)); setPlanDrafts((prev) => prev.filter((_, i) => i !== idx)); }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {COLUMNAS_RAT.map((col) => {
                      const key = col.key as string;
                      if (key === "id" || key === "rat_version_id") return null;
                      const isBool = key === "perfiles_automatizados" || key === "transferencias_internacionales";
                      if (isBool) {
                        return (
                          <div key={key}>
                            <label className="text-xs font-medium text-bac-gray-text">{col.label}</label>
                            <select
                              className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                              value={act[key] ?? ""}
                              onChange={(e) => updateAct(idx, key, e.target.value)}
                            >
                              <option value="">Seleccionar</option>
                              <option value="si">Sí</option>
                              <option value="no">No</option>
                            </select>
                          </div>
                        );
                      }
                      return (
                        <div key={key}>
                          <label className="text-xs font-medium text-bac-gray-text">{col.label}</label>
                          <input
                            className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                            value={act[key] ?? ""}
                            onChange={(e) => updateAct(idx, key, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-bac-gray-border pt-3 mt-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">Documentos adjuntos</span>
                    </div>
                    {carpetas.length > 0 && (
                      <div className="flex gap-1 mb-2">
                        <button
                          type="button"
                          onClick={() => setAdjuntoTabs((prev) => prev.map((t, i) => i === idx ? "local" : t))}
                          className={cn("rounded-md px-2 py-1 text-xs font-medium transition", (adjuntoTabs[idx] ?? "local") === "local" ? "bg-bac-red text-white" : "text-gray-600 hover:bg-gray-100")}
                        >
                          Archivo local
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjuntoTabs((prev) => prev.map((t, i) => i === idx ? "cliente" : t))}
                          className={cn("rounded-md px-2 py-1 text-xs font-medium transition", (adjuntoTabs[idx] ?? "local") === "cliente" ? "bg-blue-600 text-white" : "text-blue-600 hover:bg-blue-50")}
                        >
                          Carpetas del cliente
                        </button>
                      </div>
                    )}
                    {(adjuntoTabs[idx] ?? "local") === "local" && (
                      <label className="inline-flex items-center gap-1 text-xs font-medium text-bac-red hover:underline cursor-pointer mb-2">
                        <Paperclip className="h-3.5 w-3.5" /> Adjuntar archivo local
                        <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setArchivosAdjuntos((prev) => prev.map((files, i) => i === idx ? [...files, f] : files)); e.target.value = ""; }} />
                      </label>
                    )}
                    {(adjuntoTabs[idx] ?? "local") === "cliente" && carpetas.length > 0 && (
                      <div className="rounded-lg border border-blue-200 p-2 bg-blue-50/30 space-y-1 max-h-40 overflow-y-auto mb-2">
                        {carpetas.map((c) => (
                          <div key={c.id}>
                            <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                              <FolderOpen className="h-3 w-3" /> {c.nombre}
                            </p>
                            {c.documentos.length === 0 ? (
                              <p className="text-[10px] text-gray-400 ml-4">Sin documentos</p>
                            ) : c.documentos.map((doc) => (
                              <button
                                key={doc.id}
                                type="button"
                                onClick={() => setDocsFromFolder((prev) => prev.map((d, i) => i === idx ? doc : d))}
                                className={cn(
                                  "ml-4 mb-0.5 flex w-[calc(100%-1rem)] items-center gap-1.5 rounded border px-2 py-1 text-left text-xs transition",
                                  docsFromFolder[idx]?.id === doc.id
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-bac-gray-border text-gray-700 hover:bg-blue-50 hover:border-blue-300"
                                )}
                              >
                                <FileText className="h-3 w-3 shrink-0 text-gray-400" />
                                <span className="truncate">{doc.nombre_archivo}</span>
                                {docsFromFolder[idx]?.id === doc.id && <span className="ml-auto text-[10px] text-blue-600 font-medium">Adjunto</span>}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    {((archivosAdjuntos[idx] ?? []).length > 0 || docsFromFolder[idx]) && (
                      <div className="space-y-1">
                        {(archivosAdjuntos[idx] ?? []).map((f, fi) => (
                          <div key={`local-${fi}`} className="flex items-center justify-between bg-bac-gray-alt rounded px-2 py-1.5 text-xs text-gray-700">
                            <span className="truncate">{f.name}</span>
                            <button type="button" onClick={() => setArchivosAdjuntos((prev) => prev.map((files, i) => i === idx ? files.filter((_, j) => j !== fi) : files))} className="text-gray-400 hover:text-red-500 ml-2">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        {docsFromFolder[idx] && (
                          <div className="flex items-center justify-between bg-blue-50 rounded px-2 py-1.5 text-xs text-blue-700">
                            <div className="flex items-center gap-1 truncate">
                              <FolderOpen className="h-3 w-3 shrink-0 text-blue-400" />
                              <span className="truncate">{docsFromFolder[idx]!.nombre_archivo}</span>
                            </div>
                            <button type="button" onClick={() => setDocsFromFolder((prev) => prev.map((d, i) => i === idx ? null : d))} className="text-blue-400 hover:text-red-500 ml-2">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-bac-gray-border pt-3 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={planDrafts[idx]?.enabled ?? false}
                        onChange={(e) => setPlanDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, enabled: e.target.checked } : p))}
                        className="rounded border-gray-300 text-bac-red focus:ring-bac-red"
                      />
                      <span className="text-xs font-medium text-bac-gray-text">Crear plan de implementación para esta actividad</span>
                    </label>
                    {planDrafts[idx]?.enabled && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="text-xs font-medium text-bac-gray-text">Título del plan *</label>
                          <input
                            className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                            placeholder="Título del plan"
                            value={planDrafts[idx]?.titulo ?? ""}
                            onChange={(e) => setPlanDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, titulo: e.target.value } : p))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-bac-gray-text">Responsable</label>
                          <input
                            className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                            placeholder="Nombre del responsable"
                            value={planDrafts[idx]?.responsable ?? ""}
                            onChange={(e) => setPlanDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, responsable: e.target.value } : p))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-bac-gray-text">Departamento</label>
                          <input
                            className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                            placeholder="Ej: Talento humano"
                            value={planDrafts[idx]?.departamento ?? ""}
                            onChange={(e) => setPlanDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, departamento: e.target.value } : p))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-bac-gray-text">Nombre de la actividad</label>
                          <input
                            className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                            placeholder="Nombre de la actividad"
                            value={planDrafts[idx]?.actividad_nombre ?? ""}
                            onChange={(e) => setPlanDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, actividad_nombre: e.target.value } : p))}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs font-medium text-bac-gray-text">Actividad a realizar</label>
                          <input
                            className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                            placeholder="Describa el plan o implementación"
                            value={planDrafts[idx]?.actividad_realizar ?? ""}
                            onChange={(e) => setPlanDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, actividad_realizar: e.target.value } : p))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-bac-gray-text">Fecha inicio</label>
                          <DateInput
                            className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                            value={planDrafts[idx]?.fecha_inicio ?? ""}
                            onChange={(v) => setPlanDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, fecha_inicio: v } : p))}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-bac-gray-text">Fecha fin</label>
                          <DateInput
                            className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                            value={planDrafts[idx]?.fecha_fin ?? ""}
                            onChange={(v) => setPlanDrafts((prev) => prev.map((p, i) => i === idx ? { ...p, fecha_fin: v } : p))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => { setModal(null); setUploadResult(null); }}
            className="px-4 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleCrear}
            disabled={isPending}
            className="px-6 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark disabled:opacity-60 transition"
          >
            {isPending ? "Guardando..." : "Guardar RAT"}
          </button>
        </div>
      </div>
    );
  }

  // Normal view with data — always show the latest version
  const actual = versiones[0];
  const actividades = actual.actividades_rat ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi RAT</h1>
          <p className="text-sm text-bac-gray-text mt-1">Registro de Actividades de Tratamiento</p>
        </div>
        <div className="flex gap-2">
          {!soloLectura && (
            <>
              <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt transition cursor-pointer">
                <Upload className="w-4 h-4" />
                Subir RAT
                <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
              </label>
              <button
                onClick={() => { setActs([actividadVacia()]); setArchivosAdjuntos([[]]); setFormError(""); setUploadResult(null); setModal("crear"); }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark transition"
              >
                <Plus className="w-4 h-4" />
                Crear RAT
              </button>
            </>
          )}
          {proEfectivo && versiones.length > 0 && (
            <BotonAnalisisIA tipo="rat" onClick={() => setMostrarConfirmIA(true)} />
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
          {!soloLectura && versiones.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm("¿Eliminar todo el RAT? Esta acción no se puede deshacer.")) return;
                try {
                  await eliminarVersionRat(actual.id);
                  router.refresh();
                } catch (err: any) {
                  alert(err.message ?? "Error al eliminar el RAT.");
                }
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar RAT completo
            </button>
          )}
        </div>
      </div>

      {(actual.datos_responsable || actual.datos_dpd) && (
        <div className="bg-white rounded-xl border border-bac-gray-border">
          <button
            onClick={() => setShowResponsable(!showResponsable)}
            className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-bac-gray-alt/50 transition rounded-xl"
          >
            <span>Responsable de Tratamiento y DPD</span>
            {showResponsable ? <ChevronUp className="w-4 h-4 text-bac-gray-text" /> : <ChevronDown className="w-4 h-4 text-bac-gray-text" />}
          </button>
          {showResponsable && (
            <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-bac-gray-border pt-4">
              {actual.datos_responsable && (
                <div>
                  <h4 className="text-xs font-semibold text-bac-gray-text uppercase tracking-wide mb-2">Responsable de Tratamiento</h4>
                  <div className="space-y-1.5">
                    {Object.entries(actual.datos_responsable).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-sm">
                        <span className="text-bac-gray-text min-w-[140px]">{k}:</span>
                        <span className="font-medium">{v || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {actual.datos_dpd && (
                <div>
                  <h4 className="text-xs font-semibold text-bac-gray-text uppercase tracking-wide mb-2">Delegado de Protección de Datos</h4>
                  <div className="space-y-1.5">
                    {Object.entries(actual.datos_dpd).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-sm">
                        <span className="text-bac-gray-text min-w-[140px]">{k}:</span>
                        <span className="font-medium">{v || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-bac-gray-border overflow-hidden">
        <div className="p-4 border-b border-bac-gray-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-bac-red" />
            <span className="font-medium text-sm">{actividades.length} actividades registradas</span>
          </div>
          <span className="text-xs text-bac-gray-text">
            Versión {actual.version} — {formatearFecha(actual.created_at)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bac-red text-xs font-semibold uppercase tracking-wide text-white">
                <th className="whitespace-nowrap px-3 py-2">#</th>
                {COLUMNAS_RAT.map((col) => (
                  <th key={col.key} className="whitespace-nowrap px-3 py-2">
                    {col.label}
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2">Plan</th>
                <th className="whitespace-nowrap px-3 py-2">Doc</th>
                {!soloLectura && <th className="px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {actividades.map((act, i) => (
                <tr key={act.id} className="border-b border-bac-gray-border last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-bac-gray-text">{i + 1}</td>
                  {COLUMNAS_RAT.map((col) => (
                    <td key={col.key} className="px-3 py-1 text-bac-gray-text whitespace-pre-line text-xs" style={{ minWidth: "120px" }}>
                      {!soloLectura ? (
                        <EditableCell
                          value={act[col.key]}
                          field={col.key}
                          onSave={async (campo, valor) => {
                            await actualizarActividadRat(act.id, campo, valor);
                            router.refresh();
                          }}
                          cambios={getCambiosParaCelda(act.id, col.key)}
                        />
                      ) : (
                        celdaRat(act[col.key])
                      )}
                    </td>
                  ))}
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
                          onClick={() => setCrearPlanParaActividad({ id: act.id, nombre: act.nombre_actividad ?? `Actividad ${i + 1}` })}
                          className="inline-flex items-center gap-0.5 rounded border border-dashed border-bac-gray-border px-1.5 py-0.5 text-[10px] text-bac-gray-text hover:border-bac-red hover:text-bac-red"
                        >
                          <Plus className="h-2.5 w-2.5" /> Plan
                        </button>
                      ) : (
                        <span className="text-[10px] text-bac-gray-text">—</span>
                      );
                    })()}
                  </td>
                  <td className="px-2 py-1" style={{ minWidth: "130px" }}>
                    <DocCell
                      actividadId={act.id}
                      actividadNombre={`#${i + 1} — ${act.nombre_actividad ?? `Actividad ${i + 1}`}`}
                      carpetasEjemplo={carpetasEjemplo}
                      carpetas={carpetas}
                      soloLectura={soloLectura}
                      docs={docsActividades.filter((d) => d.actividad_rat_id === act.id)}
                    />
                  </td>
                  {!soloLectura && (
                    <td className="px-2 py-1">
                      <button
                        onClick={async () => {
                          if (!confirm("¿Eliminar esta actividad?")) return;
                          await eliminarActividadRat(act.id);
                          router.refresh();
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
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
                  <td colSpan={COLUMNAS_RAT.length + 2 + (!soloLectura ? 1 : 0)} className="px-4 py-8 text-center text-bac-gray-text">
                    Sin actividades en esta versión
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {!soloLectura && (
        <button
          onClick={() => setMostrarAgregarActividad(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-bac-gray-border px-3 py-1.5 text-xs font-medium text-bac-gray-text hover:border-bac-red hover:text-bac-red"
        >
          <Plus className="h-3.5 w-3.5" /> Añadir actividad
        </button>
      )}

      {errorIA && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorIA}
        </div>
      )}

      {mostrarConfirmIA && (
        <ConfirmacionIAModal
          tipo="rat"
          analizando={analizandoIA}
          onConfirmar={handleConfirmarIA}
          onClose={() => { if (!analizandoIA) setMostrarConfirmIA(false); }}
        />
      )}

      {resultadoIA && (
        <ResultadoIABrechasModal
          brechas={resultadoIA.brechas}
          resumen={resultadoIA.resumen}
          score={resultadoIA.score}
          onClose={() => setResultadoIA(null)}
        />
      )}

      {crearPlanParaActividad && (
        <CrearPlanRatModal
          preselectedActivityId={crearPlanParaActividad.id}
          actividades={
            versiones[0]
              ? versiones[0].actividades_rat.map((a: ActividadRat, i: number) => ({ id: a.id, index: i + 1, nombre: a.nombre_actividad ?? `Actividad ${i + 1}` }))
              : []
          }
          onClose={() => setCrearPlanParaActividad(null)}
        />
      )}

      {mostrarAgregarActividad && actual && (
        <AgregarActividadRatModalUser
          versionId={actual.id}
          carpetas={carpetas}
          onClose={() => setMostrarAgregarActividad(false)}
        />
      )}
    </div>
  );
}

function CrearPlanRatModal({
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
          tipo: "rat",
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
        <h3 className="text-base font-semibold text-gray-900 mb-4">Crear plan — RAT</h3>
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
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm"
              placeholder="Título del plan"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Responsable</label>
              <input
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm"
                placeholder="Nombre del responsable"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Departamento</label>
              <input
                value={departamento}
                onChange={(e) => setDepartamento(e.target.value)}
                className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm"
                placeholder="Ej: Talento humano"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre de la actividad</label>
            <input
              value={actividadNombre}
              onChange={(e) => setActividadNombre(e.target.value)}
              className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm"
              placeholder="Nombre de la actividad"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Actividad a realizar</label>
            <textarea
              value={actividadRealizar}
              onChange={(e) => setActividadRealizar(e.target.value)}
              className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm"
              rows={3}
              placeholder="Describa el plan o implementación"
            />
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
            <button type="button" onClick={onClose} className="rounded-lg border border-bac-gray-border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="rounded-lg bg-bac-red px-4 py-2 text-sm font-medium text-white hover:bg-bac-red-dark disabled:opacity-60">
              {isPending ? "Creando..." : "Crear plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AgregarActividadRatModalUser({
  versionId,
  carpetas = [],
  onClose,
}: {
  versionId: string;
  carpetas?: CarpetaConDocs[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    departamento: "",
    nombre_actividad: "",
    finalidad: "",
    categoria_datos: "",
    categorias_especiales: "",
    categorias_titulares: "",
    origen_datos: "",
    base_licitud: "",
    articulo_lopdp: "",
    almacenamiento: "",
    plazo_conservacion: "",
    destinatarios: "",
    transferencias_internacionales: "",
    medidas_seguridad: "",
    activo_informacion: "",
  });
  const [planEnabled, setPlanEnabled] = useState(false);
  const [plan, setPlan] = useState({ titulo: "", responsable: "", departamento: "", actividad_nombre: "", actividad_realizar: "", fecha_inicio: "", fecha_fin: "" });
  const [adjuntoMode, setAdjuntoMode] = useState<"none" | "local" | "carpeta">("none");
  const [adjuntoFile, setAdjuntoFile] = useState<File | null>(null);
  const [adjuntoDocName, setAdjuntoDocName] = useState("");
  const [adjuntoCarpeta, setAdjuntoCarpeta] = useState("");
  const [adjuntoFromFolder, setAdjuntoFromFolder] = useState<{ id: string; nombre_archivo: string; url_storage: string } | null>(null);

  const camposObligatorios = [
    { key: "nombre_actividad", label: "Actividad de Tratamiento", required: true },
    { key: "departamento", label: "Departamento", required: true },
    { key: "finalidad", label: "Finalidad", required: true },
    { key: "categoria_datos", label: "Categoría de Datos", required: true },
    { key: "base_licitud", label: "Base de Licitud", required: true },
  ];

  const camposOpcionales = [
    { key: "categorias_especiales", label: "Categorías Especiales de Datos" },
    { key: "categorias_titulares", label: "Categorías de Titulares" },
    { key: "origen_datos", label: "Origen de los Datos" },
    { key: "articulo_lopdp", label: "Artículo LOPDP" },
    { key: "almacenamiento", label: "Almacenamiento" },
    { key: "plazo_conservacion", label: "Plazo de Conservación" },
    { key: "destinatarios", label: "Destinatarios" },
    { key: "transferencias_internacionales", label: "Transferencias Internacionales de Datos" },
    { key: "medidas_seguridad", label: "Medidas Técnicas y Organizativas de Seguridad" },
    { key: "activo_informacion", label: "Activo de Información" },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre_actividad.trim()) return;
    setSaving(true);
    try {
      const newId = await agregarActividadRat(versionId, form);
      if (planEnabled && plan.titulo.trim() && newId) {
        await crearPlanUsuario({
          tipo: "rat",
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
      if (newId && adjuntoFile) {
        const targetCarpeta = adjuntoCarpeta || carpetas[0]?.nombre || "General";
        const fd = new FormData();
        fd.append("file", adjuntoFile);
        if (adjuntoDocName.trim() && adjuntoDocName.trim() !== adjuntoFile.name) {
          fd.append("nombreArchivo", adjuntoDocName.trim());
        }
        await subirDocRatEnCarpeta(newId, form.nombre_actividad, targetCarpeta, fd);
      }
      if (newId && adjuntoFromFolder) {
        const resp = await fetch(adjuntoFromFolder.url_storage);
        const blob = await resp.blob();
        const file = new File([blob], adjuntoFromFolder.nombre_archivo, { type: blob.type });
        const fd = new FormData();
        fd.append("file", file);
        fd.append("nombreArchivo", adjuntoFromFolder.nombre_archivo);
        await subirDocRatEnCarpeta(newId, form.nombre_actividad, carpetas[0]?.nombre || "General", fd);
      }
      router.refresh();
      onClose();
    } catch (err: any) {
      alert(err.message ?? "Error al crear actividad");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Nueva actividad RAT</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-xs text-bac-gray-text">
          Complete los campos obligatorios y opcionalmente los adicionales. La actividad se añadirá al final de la tabla.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-bac-red">Campos obligatorios</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {camposObligatorios.map((c) => (
                <div key={c.key} className={c.key === "nombre_actividad" ? "sm:col-span-2" : ""}>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    {c.label} <span className="text-red-500">*</span>
                  </label>
                  {c.key === "base_licitud" ? (
                    <select
                      className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/30 bg-white"
                      value={BASES_LICITUD.includes(form.base_licitud) ? form.base_licitud : form.base_licitud ? "__otro__" : ""}
                      onChange={(e) => setForm((p) => ({ ...p, base_licitud: e.target.value === "__otro__" ? "" : e.target.value }))}
                      required
                    >
                      <option value="">Selecciona...</option>
                      {BASES_LICITUD.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                      <option value="__otro__">Otro (especificar)</option>
                    </select>
                  ) : (
                    <input
                      className="w-full rounded-lg border border-bac-gray-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                      value={form[c.key as keyof typeof form]}
                      onChange={(e) => setForm((p) => ({ ...p, [c.key]: e.target.value }))}
                      placeholder={c.label}
                      required
                    />
                  )}
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

          <div className="border-t border-bac-gray-border pt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Adjuntar documento (opcional)</h4>
            <div className="flex gap-1 mb-2">
              <button type="button" onClick={() => { setAdjuntoMode("none"); setAdjuntoFile(null); setAdjuntoDocName(""); setAdjuntoCarpeta(""); setAdjuntoFromFolder(null); }}
                className={cn("rounded-md px-2 py-1 text-xs font-medium transition", adjuntoMode === "none" ? "bg-bac-red text-white" : "text-gray-600 hover:bg-gray-100")}>
                Sin adjunto
              </button>
              <button type="button" onClick={() => { setAdjuntoMode("local"); setAdjuntoFile(null); setAdjuntoDocName(""); setAdjuntoCarpeta(""); setAdjuntoFromFolder(null); }}
                className={cn("rounded-md px-2 py-1 text-xs font-medium transition", adjuntoMode === "local" ? "bg-bac-red text-white" : "text-gray-600 hover:bg-gray-100")}>
                Archivo local
              </button>
              <button type="button" onClick={() => { setAdjuntoMode("carpeta"); setAdjuntoFile(null); setAdjuntoDocName(""); setAdjuntoCarpeta(""); setAdjuntoFromFolder(null); }}
                className={cn("rounded-md px-2 py-1 text-xs font-medium transition", adjuntoMode === "carpeta" ? "bg-blue-600 text-white" : "text-blue-600 hover:bg-blue-50")}>
                Carpetas del cliente
              </button>
            </div>
            {adjuntoMode === "local" && (
              <div className="rounded-lg border border-bac-gray-border p-3 bg-gray-50 space-y-2">
                {!adjuntoFile ? (
                  <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 text-center hover:border-bac-red/50">
                    <Upload className="h-5 w-5 text-gray-400" />
                    <span className="text-xs text-gray-600">Seleccionar archivo</span>
                    <input type="file" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setAdjuntoFile(file); setAdjuntoDocName(file.name); }
                      e.target.value = "";
                    }} />
                  </label>
                ) : (
                  <>
                    <p className="text-xs text-bac-gray-text">Archivo: <span className="font-medium text-gray-700">{adjuntoFile.name}</span>
                      <button type="button" onClick={() => { setAdjuntoFile(null); setAdjuntoDocName(""); }} className="ml-2 text-red-500 hover:text-red-700 text-[10px]">Quitar</button>
                    </p>
                    <div>
                      <label className="text-xs font-medium text-bac-gray-text">Nombre del documento</label>
                      <input className="mt-1 w-full px-3 py-1.5 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30" value={adjuntoDocName} onChange={(e) => setAdjuntoDocName(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-bac-gray-text">Guardar en carpeta:</label>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {carpetas.map((c) => (
                          <button key={c.id} type="button" onClick={() => setAdjuntoCarpeta(c.nombre)}
                            className={cn("rounded border px-2 py-1 text-xs transition", adjuntoCarpeta === c.nombre ? "border-bac-red bg-bac-red/5 text-bac-red" : "border-bac-gray-border text-gray-700 hover:bg-gray-100")}>
                            {c.nombre}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            {adjuntoMode === "carpeta" && (
              <div className="rounded-lg border border-blue-200 p-3 bg-blue-50/30 space-y-1 max-h-48 overflow-y-auto">
                {carpetas.length === 0 ? (
                  <p className="text-xs text-bac-gray-text py-2 text-center">No hay carpetas del cliente.</p>
                ) : carpetas.map((c) => (
                  <div key={c.id}>
                    <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <FolderOpen className="h-3.5 w-3.5" /> {c.nombre}
                    </p>
                    {c.documentos.length === 0 ? (
                      <p className="text-[10px] text-gray-400 ml-5">Sin documentos</p>
                    ) : c.documentos.map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setAdjuntoFromFolder(doc)}
                        className={cn(
                          "ml-5 mb-0.5 flex w-[calc(100%-1.25rem)] items-center gap-1.5 rounded border px-2 py-1 text-left text-xs transition",
                          adjuntoFromFolder?.id === doc.id
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-bac-gray-border text-gray-700 hover:bg-blue-50 hover:border-blue-300"
                        )}
                      >
                        <FileText className="h-3 w-3 shrink-0 text-gray-400" />
                        <span className="truncate">{doc.nombre_archivo}</span>
                      </button>
                    ))}
                  </div>
                ))}
                {adjuntoFromFolder && (
                  <p className="mt-2 text-xs text-blue-700 font-medium border-t border-blue-200 pt-2">
                    Seleccionado: {adjuntoFromFolder.nombre_archivo}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-bac-gray-border pt-4">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" checked={planEnabled} onChange={(e) => setPlanEnabled(e.target.checked)} className="rounded border-gray-300" />
              Crear plan de implementación para esta actividad
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
            <button type="submit" disabled={saving || !form.nombre_actividad.trim() || (planEnabled && !plan.titulo.trim())} className="rounded-lg bg-bac-red px-4 py-2 text-xs font-medium text-white hover:bg-bac-red-dark disabled:opacity-50">
              {saving ? "Creando..." : "Crear actividad"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
