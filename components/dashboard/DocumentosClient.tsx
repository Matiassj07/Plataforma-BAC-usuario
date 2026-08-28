"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Download, CheckCircle2, Circle, FileText, FolderPlus,
  ChevronDown, ChevronRight, Trash2, FolderOpen, Archive, X, Pencil, RefreshCw, History, Info,
} from "lucide-react";
import {
  subirDocumentoUsuario, obtenerUrlDescarga, eliminarDocumentoUsuario,
  crearCarpeta, eliminarCarpeta, subirDocCarpeta, eliminarDocCarpeta,
  subirDocCarpetaObligatoria, renombrarDocCarpeta, reemplazarDocCarpeta,
  vincularDocAActividadRat, vincularDocGeneralAActividadRat,
  obtenerUrlDescargaActa, subirActaFirmadaCliente,
} from "@/lib/dashboard/user-actions";

interface DocSubido {
  id: string;
  tipo_documento: string;
  nombre_archivo: string;
  url_storage: string | null;
}

interface DocEjemplo {
  slug: string;
  nombre_archivo: string;
  url_storage: string;
}

interface DocCarpeta {
  id: string;
  nombre_archivo: string;
  url_storage: string;
  fecha_subida: string | null;
  actividad_rat_id?: string | null;
  nombre_actividad_rat?: string | null;
  version?: number;
  doc_original_id?: string | null;
}

interface Carpeta {
  id: string;
  nombre: string;
  created_at: string;
  carpeta_padre_id?: string | null;
  documentos: DocCarpeta[];
  subcarpetas: Carpeta[];
}

interface CarpetaEjemplo {
  id: string;
  nombre: string;
  documentos: { slug: string; nombre_archivo: string; url_storage: string }[];
}

interface ActividadRatInfo { id: string; index: number; nombre: string; }

interface ActaCliente {
  id: string;
  url_acta: string | null;
  url_acta_firmada: string | null;
  estado_implementacion: string;
  completada: boolean;
}

function ActaEntregaCliente({ acta, router }: { acta: ActaCliente; router: { refresh: () => void } }) {
  const [showInfo, setShowInfo] = useState(false);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="mt-6 rounded-xl border border-bac-gray-border bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <FileText className="h-4 w-4 text-bac-red" />
          Acta de entrega
        </h3>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-bac-gray-text hover:text-bac-red transition"
          title="Ver detalle"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>

      {showInfo && (
        <div className="mb-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
          <p className="font-medium mb-1">¿Qué es el acta de entrega?</p>
          <p className="mb-1">
            El acta de entrega certifica la implementación del sistema de protección de datos personales en tu empresa.
          </p>
          <ol className="list-decimal ml-4 space-y-0.5">
            <li>Descarga el acta de entrega proporcionada por BAC.</li>
            <li>Revisa el contenido y firma el documento.</li>
            <li>Sube el acta firmada para completar el proceso.</li>
          </ol>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          {acta.completada || acta.estado_implementacion !== "activa" ? (
            <CheckCircle2 className="h-4 w-4 text-bac-score-verde" />
          ) : (
            <Circle className="h-4 w-4 text-bac-gray-text" />
          )}
          <span className={acta.completada || acta.estado_implementacion !== "activa" ? "text-bac-score-verde font-medium" : "text-bac-gray-text"}>
            {acta.completada || acta.estado_implementacion !== "activa" ? "Implementación completada" : "Implementación activa"}
          </span>
        </div>

        {/* Acta original para descargar */}
        {acta.url_acta && (
          <div className="rounded-lg border border-bac-gray-border p-3">
            <p className="text-xs font-medium text-gray-700 mb-2">Acta original</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-bac-score-verde font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Disponible
              </span>
              <button
                onClick={async () => {
                  try {
                    const url = await obtenerUrlDescargaActa(acta.url_acta!);
                    window.open(url, "_blank");
                  } catch (e: any) { alert(e.message); }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-bac-gray-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-bac-gray-alt"
              >
                <Download className="h-3 w-3" /> Descargar para firmar
              </button>
            </div>
          </div>
        )}

        {/* Acta firmada */}
        <div className="rounded-lg border border-bac-gray-border p-3">
          <p className="text-xs font-medium text-gray-700 mb-2">Acta firmada</p>

          {acta.url_acta_firmada ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-bac-score-verde font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Firmada subida
              </span>
              <button
                onClick={async () => {
                  try {
                    const url = await obtenerUrlDescargaActa(acta.url_acta_firmada!);
                    window.open(url, "_blank");
                  } catch (e: any) { alert(e.message); }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-bac-gray-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-bac-gray-alt"
              >
                <Download className="h-3 w-3" /> Descargar
              </button>
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-bac-gray-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-bac-gray-alt cursor-pointer">
                <Upload className="h-3 w-3" /> Reemplazar
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      await subirActaFirmadaCliente(fd);
                      router.refresh();
                    } catch (err: any) { alert(err.message); }
                    setUploading(false);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className={`inline-flex items-center gap-1.5 rounded-lg bg-bac-red px-3 py-1.5 text-xs font-medium text-white hover:bg-bac-red-dark cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="h-3 w-3" /> Subir acta firmada
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      await subirActaFirmadaCliente(fd);
                      router.refresh();
                    } catch (err: any) { alert(err.message); }
                    setUploading(false);
                    e.target.value = "";
                  }}
                />
              </label>
              {!acta.url_acta && (
                <span className="text-xs text-bac-gray-text">Primero descarga el acta original</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  initialDocsSubidos: DocSubido[];
  ejemplos: DocEjemplo[];
  soloLectura?: boolean;
  carpetas?: Carpeta[];
  canCreateFolders?: boolean;
  carpetasEjemplo?: CarpetaEjemplo[];
  actividadesRat?: ActividadRatInfo[];
  acta?: ActaCliente | null;
}

export default function DocumentosClient({
  initialDocsSubidos, ejemplos, soloLectura, carpetas: initialCarpetas, canCreateFolders,
  carpetasEjemplo, actividadesRat = [], acta = null,
}: Props) {
  const router = useRouter();

  const actMap = new Map<string, ActividadRatInfo>();
  for (const a of actividadesRat) actMap.set(a.id, a);

  function ratLabel(doc: DocCarpeta): string | null {
    if (!doc.actividad_rat_id) return null;
    const act = actMap.get(doc.actividad_rat_id);
    if (act) return `#${act.index} — ${act.nombre}`;
    return doc.nombre_actividad_rat ?? null;
  }

  const [docsSubidos, setDocsSubidos] = useState<DocSubido[]>(initialDocsSubidos);
  useEffect(() => { setDocsSubidos(initialDocsSubidos); }, [initialDocsSubidos]);
  const [carpetas, setCarpetas] = useState<Carpeta[]>(initialCarpetas ?? []);
  useEffect(() => { setCarpetas(initialCarpetas ?? []); }, [initialCarpetas]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [zipping, setZipping] = useState<string | null>(null);
  const [zippingAll, setZippingAll] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ file: File; target: string; targetId: string } | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [selectedRatId, setSelectedRatId] = useState<string>("");
  const [editingDoc, setEditingDoc] = useState<{ id: string; nombre: string } | null>(null);
  const [renamingDoc, setRenamingDoc] = useState(false);
  const [replacingDoc, setReplacingDoc] = useState<string | null>(null);
  const [vincularPrompt, setVincularPrompt] = useState<{ docId: string; tabla?: "carpeta" | "general" } | null>(null);
  const [vinculando, setVinculando] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [pendingMultiUpload, setPendingMultiUpload] = useState<{ files: File[]; carpetaId: string } | null>(null);
  const [multiUploadProgress, setMultiUploadProgress] = useState(0);
  const [showNewSubfolder, setShowNewSubfolder] = useState<string | null>(null);
  const [newSubfolderName, setNewSubfolderName] = useState("");

  function toggleVersionHistory(groupKey: string) {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
      return next;
    });
  }

  function groupDocsByVersion(docs: DocCarpeta[]) {
    const groups = new Map<string, DocCarpeta[]>();
    for (const doc of docs) {
      const key = doc.doc_original_id ?? doc.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(doc);
    }
    const result: { latest: DocCarpeta; previous: DocCarpeta[] }[] = [];
    for (const [, group] of groups) {
      const sorted = group.sort((a, b) => (b.version ?? 1) - (a.version ?? 1));
      result.push({ latest: sorted[0], previous: sorted.slice(1) });
    }
    return result;
  }

  async function handleReplaceDoc(docId: string, file: File) {
    setReplacingDoc(docId);
    try {
      const fd = new FormData();
      fd.set("file", file);
      await reemplazarDocCarpeta(docId, fd);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setReplacingDoc(null);
    }
  }

  async function handleUpload(slug: string, file: File) {
    setUploading(slug);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("tipo_documento", slug);
      const result = await subirDocumentoUsuario(formData);
      setDocsSubidos((prev) => {
        const exists = prev.find((d) => d.tipo_documento === slug);
        if (exists) return prev;
        return [...prev, { id: "", tipo_documento: slug, nombre_archivo: "", url_storage: null }];
      });
      router.refresh();
      if (result?.docId && actividadesRat.length > 0) {
        setVincularPrompt({ docId: result.docId, tabla: "general" });
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(null);
    }
  }

  async function handleDownload(bucket: string, path: string, filename: string) {
    setDownloading(path);
    try {
      const url = await obtenerUrlDescarga(bucket, path);
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDownloading(null);
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await crearCarpeta(newFolderName.trim());
      setNewFolderName("");
      setShowNewFolder(false);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleCreateSubfolder(carpetaPadreId: string) {
    if (!newSubfolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await crearCarpeta(newSubfolderName.trim(), carpetaPadreId);
      setNewSubfolderName("");
      setShowNewSubfolder(null);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleMultiUploadConfirm() {
    if (!pendingMultiUpload) return;
    const { files, carpetaId } = pendingMultiUpload;
    setUploading(`folder-${carpetaId}`);
    setMultiUploadProgress(0);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.set("file", files[i]);
        await subirDocCarpeta(carpetaId, formData);
        setMultiUploadProgress(i + 1);
      }
      setPendingMultiUpload(null);
      setMultiUploadProgress(0);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(null);
    }
  }

  async function handleDeleteFolder(carpetaId: string) {
    if (!confirm("¿Eliminar esta carpeta y todos sus documentos?")) return;
    try {
      await eliminarCarpeta(carpetaId);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }

  function handleFileSelectedForFolder(carpetaId: string, file: File) {
    setPendingUpload({ file, target: "folder", targetId: carpetaId });
    setUploadName(file.name);
  }

  async function handleConfirmPendingUpload() {
    if (!pendingUpload) return;
    const { file, target, targetId } = pendingUpload;
    const key = target === "folder" ? `folder-${targetId}` : `ej-${targetId}`;
    setUploading(key);
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (uploadName.trim() && uploadName.trim() !== file.name) {
        formData.set("nombreArchivo", uploadName.trim());
      }
      let docId: string | undefined;
      if (target === "folder") {
        const result = await subirDocCarpeta(targetId, formData);
        docId = result?.docId;
      } else {
        const result = await subirDocCarpetaObligatoria(targetId, formData);
        docId = result?.docId;
      }
      if (docId && selectedRatId) {
        const act = actividadesRat.find((a) => a.id === selectedRatId);
        if (act) {
          await vincularDocAActividadRat(docId, act.id, act.nombre);
        }
      }
      setPendingUpload(null);
      setUploadName("");
      setSelectedRatId("");
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(null);
    }
  }

  async function handleRenameDoc() {
    if (!editingDoc || !editingDoc.nombre.trim()) return;
    setRenamingDoc(true);
    try {
      await renombrarDocCarpeta(editingDoc.id, editingDoc.nombre.trim());
      setEditingDoc(null);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRenamingDoc(false);
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (!confirm("¿Eliminar este documento?")) return;
    try {
      await eliminarDocCarpeta(docId);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }

  function handleFileSelectedForObligatoria(nombreCarpeta: string, file: File) {
    setPendingUpload({ file, target: "obligatoria", targetId: nombreCarpeta });
    setUploadName(file.name);
  }

  async function addCarpetaToZip(zipFolder: any, carpeta: Carpeta) {
    for (const doc of carpeta.documentos) {
      const url = await obtenerUrlDescarga("documentos", doc.url_storage);
      const res = await fetch(url);
      const blob = await res.blob();
      zipFolder.file(doc.nombre_archivo, blob);
    }
    for (const sub of (carpeta.subcarpetas ?? [])) {
      const subFolder = zipFolder.folder(sub.nombre)!;
      await addCarpetaToZip(subFolder, sub);
    }
  }

  async function handleZipFolder(carpeta: Carpeta) {
    if (countTotalDocs(carpeta) === 0) return;
    setZipping(carpeta.id);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      await addCarpetaToZip(zip, carpeta);
      const content = await zip.generateAsync({ type: "blob" });
      const objectUrl = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${carpeta.nombre}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      alert("Error al crear ZIP: " + e.message);
    } finally {
      setZipping(null);
    }
  }

  async function handleZipAll() {
    const ejemploNombresSet = new Set((carpetasEjemplo ?? []).map((c) => c.nombre));
    const custom = carpetas.filter((c) => !ejemploNombresSet.has(c.nombre));
    const hasEjemploDocs = (carpetasEjemplo ?? []).some((ce) => {
      const cc = carpetas.find((c) => c.nombre === ce.nombre);
      const slugDocs = ce.documentos.filter((d) => docsSubidos.some((ds) => ds.tipo_documento === d.slug && ds.url_storage));
      return slugDocs.length > 0 || (cc && countTotalDocs(cc) > 0);
    });
    if (!hasEjemploDocs && custom.every((c) => countTotalDocs(c) === 0)) return;
    setZippingAll(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const ce of (carpetasEjemplo ?? [])) {
        const cc = carpetas.find((c) => c.nombre === ce.nombre);
        const slugDocs = ce.documentos
          .map((d) => docsSubidos.find((ds) => ds.tipo_documento === d.slug && ds.url_storage))
          .filter((d): d is DocSubido => !!d);
        const extraDocs = cc?.documentos ?? [];
        if (slugDocs.length === 0 && extraDocs.length === 0 && (!cc || (cc.subcarpetas ?? []).length === 0)) continue;
        const folder = zip.folder(ce.nombre)!;
        for (const doc of slugDocs) {
          const url = await obtenerUrlDescarga("documentos", doc.url_storage!);
          const res = await fetch(url);
          const blob = await res.blob();
          folder.file(doc.nombre_archivo || doc.tipo_documento, blob);
        }
        for (const doc of extraDocs) {
          const url = await obtenerUrlDescarga("documentos", doc.url_storage);
          const res = await fetch(url);
          const blob = await res.blob();
          folder.file(doc.nombre_archivo, blob);
        }
        if (cc) {
          for (const sub of (cc.subcarpetas ?? [])) {
            const subFolder = folder.folder(sub.nombre)!;
            await addCarpetaToZip(subFolder, sub);
          }
        }
      }
      for (const carpeta of custom) {
        if (countTotalDocs(carpeta) === 0) continue;
        const folder = zip.folder(carpeta.nombre)!;
        await addCarpetaToZip(folder, carpeta);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const objectUrl = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "documentos_completos.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      alert("Error al crear ZIP: " + e.message);
    } finally {
      setZippingAll(false);
    }
  }

  function toggleFolder(id: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function countTotalDocs(c: Carpeta): number {
    return c.documentos.length + (c.subcarpetas ?? []).reduce((sum, sub) => sum + countTotalDocs(sub), 0);
  }

  function renderCarpetaUsuario(carpeta: Carpeta, depth: number): React.ReactNode {
    const isExpanded = expandedFolders.has(carpeta.id);
    const totalDocs = countTotalDocs(carpeta);
    const padLeft = 12 + depth * 16;
    const subs = carpeta.subcarpetas ?? [];
    return (
      <div key={carpeta.id} className={`bg-white rounded-xl border border-bac-gray-border overflow-hidden ${depth > 0 ? "ml-4 mt-1" : ""}`}>
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
          onClick={() => toggleFolder(carpeta.id)}
        >
          <div className="flex items-center gap-3">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-bac-gray-text" /> : <ChevronRight className="w-4 h-4 text-bac-gray-text" />}
            <FolderOpen className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-gray-900">{carpeta.nombre}</span>
            <span className="text-[10px] text-bac-gray-text bg-bac-gray-alt px-2 py-0.5 rounded-full">
              {totalDocs} doc{totalDocs !== 1 ? "s" : ""}
              {subs.length > 0 && ` · ${subs.length} subcarpeta${subs.length !== 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {!soloLectura && (
              <label className="flex items-center gap-1 text-xs text-bac-red hover:text-bac-red-dark cursor-pointer px-2 py-1 rounded hover:bg-bac-red/5">
                <Upload className="w-3 h-3" />
                {uploading === `folder-${carpeta.id}` ? "..." : "Subir"}
                <input
                  type="file"
                  className="hidden"
                  multiple
                  disabled={!!uploading}
                  onChange={(e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    if (files.length === 1) {
                      handleFileSelectedForFolder(carpeta.id, files[0]);
                    } else {
                      setPendingMultiUpload({ files: Array.from(files), carpetaId: carpeta.id });
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            {canCreateFolders && (
              <button
                onClick={() => { setShowNewSubfolder(carpeta.id); setNewSubfolderName(""); }}
                className="p-1 text-bac-gray-text hover:text-amber-600 rounded"
                title="Crear subcarpeta"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            )}
            {canCreateFolders && (
              <button
                onClick={() => handleDeleteFolder(carpeta.id)}
                className="p-1 text-bac-gray-text hover:text-red-600 rounded"
                title="Eliminar carpeta"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-bac-gray-border">
            {showNewSubfolder === carpeta.id && (
              <div className="px-4 py-2 bg-amber-50/50 border-b border-bac-gray-border">
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-1.5 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    placeholder="Nombre de la subcarpeta"
                    value={newSubfolderName}
                    onChange={(e) => setNewSubfolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateSubfolder(carpeta.id)}
                    autoFocus
                  />
                  <button
                    onClick={() => handleCreateSubfolder(carpeta.id)}
                    disabled={creatingFolder || !newSubfolderName.trim()}
                    className="px-3 py-1.5 text-xs bg-bac-red text-white rounded-lg hover:bg-bac-red-dark disabled:opacity-60"
                  >
                    {creatingFolder ? "..." : "Crear"}
                  </button>
                  <button
                    onClick={() => { setShowNewSubfolder(null); setNewSubfolderName(""); }}
                    className="px-3 py-1.5 text-xs border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            {carpeta.documentos.length === 0 && subs.length === 0 ? (
              <p className="px-4 py-3 text-xs text-bac-gray-text">Sin documentos en esta carpeta</p>
            ) : (
              <>
                {carpeta.documentos.length > 0 && (
                  <div className="divide-y divide-bac-gray-border">
                    {groupDocsByVersion(carpeta.documentos).map(({ latest: doc, previous }) => {
                      const isReplacing = replacingDoc === doc.id;
                      const groupKey = doc.doc_original_id ?? doc.id;
                      const isHistoryOpen = expandedVersions.has(groupKey);
                      return (
                        <div key={doc.id}>
                          <div className="flex items-center justify-between px-4 py-2.5" style={{ paddingLeft: padLeft }}>
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-bac-gray-text" />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-gray-800">{doc.nombre_archivo}</span>
                                  {(doc.version ?? 1) > 1 && <span className="text-[9px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">v{doc.version}</span>}
                                </div>
                                {doc.nombre_actividad_rat && (
                                  <p className="text-[10px] text-bac-red font-medium">RAT · {doc.nombre_actividad_rat}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {previous.length > 0 && (
                                <button
                                  onClick={() => toggleVersionHistory(groupKey)}
                                  className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-50"
                                  title="Ver versiones anteriores"
                                >
                                  <History className="h-3 w-3" />
                                  {previous.length} ant.
                                </button>
                              )}
                              {!soloLectura && (
                                <button
                                  onClick={() => setEditingDoc({ id: doc.id, nombre: doc.nombre_archivo })}
                                  className="p-1 text-bac-gray-text hover:text-bac-red rounded"
                                  title="Renombrar"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDownload("documentos", doc.url_storage, doc.nombre_archivo)}
                                disabled={downloading === doc.url_storage}
                                className="flex items-center gap-1 text-xs text-bac-gray-text hover:text-bac-red px-2 py-1 rounded hover:bg-bac-gray-alt"
                              >
                                <Download className="w-3 h-3" />
                                {downloading === doc.url_storage ? "..." : "Descargar"}
                              </button>
                              {!soloLectura && (
                                <>
                                  <label className={`flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 cursor-pointer ${isReplacing ? "opacity-50 pointer-events-none" : ""}`}>
                                    <RefreshCw className="w-3 h-3" />
                                    {isReplacing ? "..." : "Reemplazar"}
                                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="hidden" disabled={isReplacing} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReplaceDoc(doc.id, f); e.target.value = ""; }} />
                                  </label>
                                  <button
                                    onClick={() => handleDeleteDoc(doc.id)}
                                    className="p-1 text-bac-gray-text hover:text-red-600 rounded"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {isHistoryOpen && previous.map((prev) => (
                            <div key={prev.id} className="flex items-center justify-between px-4 py-1.5 bg-gray-50" style={{ paddingLeft: padLeft + 16 }}>
                              <div className="flex items-center gap-2">
                                <FileText className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-500">{prev.nombre_archivo}</span>
                                <span className="text-[9px] font-medium bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">v{prev.version ?? 1}</span>
                              </div>
                              <button
                                onClick={() => handleDownload("documentos", prev.url_storage, prev.nombre_archivo)}
                                disabled={downloading === prev.url_storage}
                                className="inline-flex items-center gap-1 text-[10px] text-bac-gray-text hover:text-bac-red px-1.5 py-0.5 rounded hover:bg-bac-gray-alt"
                              >
                                <Download className="h-2.5 w-2.5" />
                                {downloading === prev.url_storage ? "..." : "Descargar"}
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
                {subs.length > 0 && (
                  <div className="px-2 py-2 space-y-1">
                    {subs.map((sub) => renderCarpetaUsuario(sub, depth + 1))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  const ejemploNombres = new Set((carpetasEjemplo ?? []).map((c) => c.nombre));
  const customCarpetas = carpetas.filter((c) => !ejemploNombres.has(c.nombre));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentos</h1>
          <p className="text-sm text-bac-gray-text mt-1">
            Documentos requeridos para cumplimiento LOPDP
          </p>
        </div>
      </div>

      {/* Botón descargar todo */}
      {(docsSubidos.some((d) => d.url_storage) || carpetas.some((c) => c.documentos.length > 0)) && (
        <div className="flex justify-end">
          <button
            onClick={handleZipAll}
            disabled={zippingAll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-bac-red px-4 py-2 text-sm font-medium text-white hover:bg-bac-red-dark disabled:opacity-60"
          >
            <Archive className="h-4 w-4" />
            {zippingAll ? "Creando ZIP..." : "Descargar todo en ZIP"}
          </button>
        </div>
      )}

      {/* Carpetas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Carpetas</h2>
          {canCreateFolders && (
            <button
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-bac-red border border-bac-red/20 rounded-lg hover:bg-bac-red/5 transition"
            >
              <FolderPlus className="w-4 h-4" />
              Nueva carpeta
            </button>
          )}
        </div>

        {showNewFolder && (
          <div className="bg-white rounded-xl border border-bac-gray-border p-4">
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                placeholder="Nombre de la carpeta"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              />
              <button
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
                className="px-4 py-2 text-sm bg-bac-red text-white rounded-lg hover:bg-bac-red-dark disabled:opacity-60"
              >
                {creatingFolder ? "..." : "Crear"}
              </button>
              <button
                onClick={() => { setShowNewFolder(false); setNewFolderName(""); }}
                className="px-3 py-2 text-sm border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Carpetas obligatorias (*) */}
        {carpetasEjemplo && carpetasEjemplo.map((carpeta) => {
          const isExpanded = expandedFolders.has(`ej-${carpeta.id}`);
          const clientCarpeta = carpetas.find((c) => c.nombre === carpeta.nombre);
          const extraDocs = clientCarpeta?.documentos ?? [];
          const totalCount = carpeta.documentos.length + extraDocs.length;
          return (
            <div key={`ej-${carpeta.id}`} className="rounded-xl border border-bac-gray-border bg-white overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleFolder(`ej-${carpeta.id}`)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-bac-gray-text" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-bac-gray-text" />
                  )}
                  <FolderOpen className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-gray-900">{carpeta.nombre} *</span>
                  <span className="text-[10px] text-bac-gray-text bg-bac-gray-alt px-2 py-0.5 rounded-full">
                    {totalCount} doc{totalCount !== 1 ? "s" : ""}
                  </span>
                </div>
                {!soloLectura && (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <label className="flex items-center gap-1 text-xs text-bac-red hover:text-bac-red-dark cursor-pointer px-2 py-1 rounded hover:bg-bac-red/5">
                      <Upload className="w-3 h-3" />
                      {uploading === `ej-${carpeta.nombre}` ? "..." : "Subir"}
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                        className="hidden"
                        disabled={uploading === `ej-${carpeta.nombre}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelectedForObligatoria(carpeta.nombre, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
              {isExpanded && (
                <div className="border-t border-bac-gray-border">
                  {totalCount === 0 ? (
                    <p className="px-4 py-3 text-xs text-bac-gray-text">Sin documentos en esta carpeta</p>
                  ) : (
                    <div className="divide-y divide-bac-gray-border">
                      {carpeta.documentos.map((doc) => {
                        const docSubido = docsSubidos.find((d) => d.tipo_documento === doc.slug);
                        const subido = !!docSubido;
                        return (
                          <div key={doc.slug} className="flex items-center justify-between px-4 py-2.5 pl-12">
                            <div className="flex items-center gap-2">
                              {subido ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-bac-score-verde flex-shrink-0" />
                              ) : (
                                <Circle className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                              )}
                              <span className="text-sm text-gray-800">{doc.nombre_archivo}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDownload("ejemplos-documentos", doc.url_storage, doc.nombre_archivo)}
                                disabled={downloading === doc.url_storage}
                                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-60"
                              >
                                <FileText className="w-3 h-3" />
                                {downloading === doc.url_storage ? "..." : "Ejemplo"}
                              </button>
                              {subido && docSubido?.url_storage && (
                                <>
                                  <button
                                    onClick={() => handleDownload("documentos", docSubido.url_storage!, docSubido.nombre_archivo || doc.nombre_archivo)}
                                    disabled={downloading === docSubido.url_storage}
                                    className="flex items-center gap-1 text-xs text-bac-gray-text hover:text-bac-red px-2 py-1 border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt disabled:opacity-60"
                                  >
                                    <Download className="w-3 h-3" />
                                    {downloading === docSubido.url_storage ? "..." : "Descargar"}
                                  </button>
                                  {!soloLectura && (
                                    <button
                                      onClick={async () => {
                                        if (!confirm("¿Eliminar este documento?")) return;
                                        try {
                                          await eliminarDocumentoUsuario(docSubido.id);
                                          router.refresh();
                                        } catch (e: any) {
                                          alert(e.message);
                                        }
                                      }}
                                      className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 border border-bac-gray-border rounded-lg hover:bg-red-50"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </>
                              )}
                              {!soloLectura && (
                                <label className="flex items-center gap-1 text-xs font-medium text-bac-red hover:text-bac-red-dark cursor-pointer px-2 py-1 border border-bac-red/20 rounded-lg hover:bg-bac-red/5">
                                  <Upload className="w-3 h-3" />
                                  {uploading === doc.slug ? "..." : subido ? "Reemplazar" : "Subir"}
                                  <input
                                    type="file"
                                    className="hidden"
                                    disabled={uploading === doc.slug}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUpload(doc.slug, file);
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {groupDocsByVersion(extraDocs).map(({ latest: doc, previous }) => {
                        const isReplacing = replacingDoc === doc.id;
                        const groupKey = doc.doc_original_id ?? doc.id;
                        const isHistoryOpen = expandedVersions.has(`ej-${groupKey}`);
                        return (
                          <div key={doc.id}>
                            <div className="flex items-center justify-between px-4 py-2.5 pl-12">
                              <div className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 text-bac-gray-text" />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm text-gray-800">{doc.nombre_archivo}</span>
                                    {(doc.version ?? 1) > 1 && <span className="text-[9px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">v{doc.version}</span>}
                                  </div>
                                  {ratLabel(doc) && (
                                    <p className="text-[10px] text-bac-red font-medium">RAT · {ratLabel(doc)}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {previous.length > 0 && (
                                  <button
                                    onClick={() => toggleVersionHistory(`ej-${groupKey}`)}
                                    className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 px-2 py-1 rounded hover:bg-amber-50"
                                    title="Ver versiones anteriores"
                                  >
                                    <History className="h-3 w-3" />
                                    {previous.length} ant.
                                  </button>
                                )}
                                {!soloLectura && (
                                  <button
                                    onClick={() => setEditingDoc({ id: doc.id, nombre: doc.nombre_archivo })}
                                    className="p-1 text-bac-gray-text hover:text-bac-red rounded"
                                    title="Renombrar"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDownload("documentos", doc.url_storage, doc.nombre_archivo)}
                                  disabled={downloading === doc.url_storage}
                                  className="flex items-center gap-1 text-xs text-bac-gray-text hover:text-bac-red px-2 py-1 rounded hover:bg-bac-gray-alt"
                                >
                                  <Download className="w-3 h-3" />
                                  {downloading === doc.url_storage ? "..." : "Descargar"}
                                </button>
                                {!soloLectura && (
                                  <>
                                    <label className={`flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 cursor-pointer ${isReplacing ? "opacity-50 pointer-events-none" : ""}`}>
                                      <RefreshCw className="w-3 h-3" />
                                      {isReplacing ? "..." : "Reemplazar"}
                                      <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" className="hidden" disabled={isReplacing} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReplaceDoc(doc.id, f); e.target.value = ""; }} />
                                    </label>
                                    <button
                                      onClick={() => handleDeleteDoc(doc.id)}
                                      className="p-1 text-bac-gray-text hover:text-red-600 rounded"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {isHistoryOpen && previous.map((prev) => (
                              <div key={prev.id} className="flex items-center justify-between px-4 py-1.5 pl-16 bg-gray-50">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">{prev.nombre_archivo}</span>
                                  <span className="text-[9px] font-medium bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">v{prev.version ?? 1}</span>
                                </div>
                                <button
                                  onClick={() => handleDownload("documentos", prev.url_storage, prev.nombre_archivo)}
                                  disabled={downloading === prev.url_storage}
                                  className="inline-flex items-center gap-1 text-[10px] text-bac-gray-text hover:text-bac-red px-1.5 py-0.5 rounded hover:bg-bac-gray-alt"
                                >
                                  <Download className="h-2.5 w-2.5" />
                                  {downloading === prev.url_storage ? "..." : "Descargar"}
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {customCarpetas.length === 0 && (!carpetasEjemplo || carpetasEjemplo.length === 0) && !showNewFolder ? (
          <div className="bg-white rounded-xl border border-bac-gray-border p-8 text-center">
            <FolderOpen className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="mt-3 text-sm text-bac-gray-text">No hay carpetas creadas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {customCarpetas.map((carpeta) => renderCarpetaUsuario(carpeta, 0))}
          </div>
        )}
      </div>

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
              onKeyDown={(e) => e.key === "Enter" && handleRenameDoc()}
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
                onClick={handleRenameDoc}
                disabled={renamingDoc || !editingDoc.nombre.trim()}
                className="rounded-lg bg-bac-red px-3 py-1.5 text-xs font-medium text-white hover:bg-bac-red/90 disabled:opacity-50"
              >
                {renamingDoc ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setPendingUpload(null); setUploadName(""); setSelectedRatId(""); }}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Subir documento</h3>
              <button onClick={() => { setPendingUpload(null); setUploadName(""); setSelectedRatId(""); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-2 text-xs text-bac-gray-text">
              Archivo: <span className="font-medium text-gray-700">{pendingUpload.file.name}</span>
            </p>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del documento</label>
            <input
              className="w-full px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
              placeholder="Nombre del documento"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              autoFocus
            />
            {actividadesRat.length > 0 && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Asignar a actividad RAT (opcional)</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30 bg-white"
                  value={selectedRatId}
                  onChange={(e) => setSelectedRatId(e.target.value)}
                >
                  <option value="">— Sin asignar —</option>
                  {actividadesRat.map((act) => (
                    <option key={act.id} value={act.id}>#{act.index} — {act.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setPendingUpload(null); setUploadName(""); setSelectedRatId(""); }}
                className="rounded-lg border border-bac-gray-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-bac-gray-alt"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPendingUpload}
                disabled={!!uploading}
                className="rounded-lg bg-bac-red px-3 py-1.5 text-xs font-medium text-white hover:bg-bac-red/90 disabled:opacity-50"
              >
                {uploading ? "Subiendo..." : "Subir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingMultiUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!uploading) setPendingMultiUpload(null); }}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Subir {pendingMultiUpload.files.length} archivos</h3>
              <button onClick={() => { if (!uploading) setPendingMultiUpload(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1 max-h-40 overflow-y-auto mb-3">
              {pendingMultiUpload.files.map((f, i) => (
                <li key={i} className="text-xs text-gray-700 flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-bac-gray-text shrink-0" />
                  {f.name}
                  {uploading && i < multiUploadProgress && <CheckCircle2 className="h-3 w-3 text-bac-score-verde shrink-0" />}
                </li>
              ))}
            </ul>
            {uploading && (
              <div className="mb-3">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-bac-red rounded-full transition-all" style={{ width: `${(multiUploadProgress / pendingMultiUpload.files.length) * 100}%` }} />
                </div>
                <p className="text-[10px] text-bac-gray-text mt-1">{multiUploadProgress} de {pendingMultiUpload.files.length} subidos</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingMultiUpload(null)}
                disabled={!!uploading}
                className="rounded-lg border border-bac-gray-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-bac-gray-alt disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleMultiUploadConfirm}
                disabled={!!uploading}
                className="rounded-lg bg-bac-red px-3 py-1.5 text-xs font-medium text-white hover:bg-bac-red/90 disabled:opacity-50"
              >
                {uploading ? "Subiendo..." : "Subir todos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {acta && (
        <ActaEntregaCliente acta={acta} router={router} />
      )}

      {vincularPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setVincularPrompt(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">¿Vincular a actividad RAT?</h3>
            <p className="text-xs text-bac-gray-text mb-3">Selecciona una actividad para vincular este documento, o cierra para omitir.</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {actividadesRat.map((act) => (
                <button
                  key={act.id}
                  disabled={vinculando}
                  onClick={async () => {
                    setVinculando(true);
                    try {
                      if (vincularPrompt.tabla === "general") {
                        await vincularDocGeneralAActividadRat(vincularPrompt.docId, act.id, act.nombre);
                      } else {
                        await vincularDocAActividadRat(vincularPrompt.docId, act.id, act.nombre);
                      }
                      router.refresh();
                    } catch (e: any) {
                      alert(e.message);
                    } finally {
                      setVinculando(false);
                      setVincularPrompt(null);
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-bac-gray-alt transition disabled:opacity-50"
                >
                  <span className="text-bac-gray-text text-xs mr-1">#{act.index}</span> {act.nombre}
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setVincularPrompt(null)}
                className="rounded-lg border border-bac-gray-border px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-bac-gray-alt"
              >
                Omitir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
