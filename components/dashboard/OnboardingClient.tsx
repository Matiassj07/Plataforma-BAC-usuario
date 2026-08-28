"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Building2, Shield, FolderOpen, CheckCircle2, ChevronRight, ChevronLeft, X } from "lucide-react";
import { actualizarPerfil, completarOnboarding } from "@/lib/dashboard/user-actions";
import { SECTOR_LABELS, TAMANO_LABELS, TIENE_DPD_LABELS, DPD_TIPO_LABELS } from "@/lib/types";
import type { NichoEnum, TamanoEmpresaEnum, TieneDpdEnum, DpdTipoEnum } from "@/lib/types";

const SECTORES = Object.entries(SECTOR_LABELS) as [NichoEnum, string][];
const TAMANOS = Object.entries(TAMANO_LABELS) as [TamanoEmpresaEnum, string][];
const DPD_OPTIONS = Object.entries(TIENE_DPD_LABELS) as [TieneDpdEnum, string][];

const DATOS_ESPECIALES = [
  "Datos de salud",
  "Datos biométricos",
  "Datos genéticos",
  "Datos de menores",
  "Datos de orientación sexual",
  "Datos religiosos/filosóficos",
  "Datos de afiliación sindical",
  "Datos de origen étnico",
];

const PASOS = [
  { icon: Building2, label: "Datos de empresa" },
  { icon: Shield, label: "Protección de datos" },
  { icon: FolderOpen, label: "Documentos" },
];

interface InitialProfile {
  nombre_empresa: string;
  ruc: string;
  direccion: string;
  telefono: string;
  web: string;
  nicho: NichoEnum;
  tamano_empresa: TamanoEmpresaEnum | null;
  tiene_dpd: TieneDpdEnum | null;
  trata_datos_especiales: string[];
  dpd_tipo: DpdTipoEnum | null;
  onboarding_paso: number;
}

export default function OnboardingClient({
  initialProfile,
  sectoresCustom = [],
}: {
  initialProfile: InitialProfile;
  sectoresCustom?: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const startPaso = Math.max(1, Math.min(initialProfile.onboarding_paso, 3));
  const [paso, setPaso] = useState(startPaso);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [empresa, setEmpresa] = useState({
    nombre_empresa: initialProfile.nombre_empresa,
    ruc: initialProfile.ruc,
    direccion: initialProfile.direccion,
    telefono: initialProfile.telefono,
    web: initialProfile.web,
    nicho: initialProfile.nicho,
    tamano_empresa: initialProfile.tamano_empresa,
  });

  const [proteccion, setProteccion] = useState({
    tiene_dpd: initialProfile.tiene_dpd,
    dpd_tipo: initialProfile.dpd_tipo,
    trata_datos_especiales: initialProfile.trata_datos_especiales,
  });

  function validarPaso(): boolean {
    const errs: string[] = [];
    if (paso === 1) {
      if (!empresa.nombre_empresa.trim()) errs.push("Nombre de empresa es obligatorio");
      if (!empresa.nicho || empresa.nicho === "otros" && !empresa.nombre_empresa.trim()) errs.push("Sector es obligatorio");
    }
    setErrors(errs);
    return errs.length === 0;
  }

  async function guardarYAvanzar() {
    if (!validarPaso()) return;
    setSaving(true);
    setErrors([]);
    try {
      if (paso === 1 || paso === 2) {
        await actualizarPerfil({
          ...empresa,
          tiene_dpd: proteccion.tiene_dpd,
          dpd_tipo: proteccion.dpd_tipo,
          trata_datos_especiales: proteccion.trata_datos_especiales,
        });
      }

      if (paso < 3) {
        await completarOnboarding(paso + 1);
        setPaso(paso + 1);
      } else {
        await completarOnboarding(5);
        router.push("/dashboard");
        router.refresh();
      }
    } catch (e: any) {
      setErrors([e.message]);
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    if (empresa.nombre_empresa.trim()) {
      setSaving(true);
      try {
        await actualizarPerfil({
          ...empresa,
          tiene_dpd: proteccion.tiene_dpd,
          dpd_tipo: proteccion.dpd_tipo,
          trata_datos_especiales: proteccion.trata_datos_especiales,
        });
        await completarOnboarding(5);
        router.push("/dashboard");
        router.refresh();
      } catch (e: any) {
        setErrors([e.message]);
      } finally {
        setSaving(false);
      }
    } else {
      setErrors(["Debes completar al menos el nombre de empresa antes de salir"]);
    }
  }

  function toggleDato(dato: string) {
    setProteccion((prev) => ({
      ...prev,
      trata_datos_especiales: prev.trata_datos_especiales.includes(dato)
        ? prev.trata_datos_especiales.filter((d) => d !== dato)
        : [...prev.trata_datos_especiales, dato],
    }));
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <Image src="/logo-bac.jpg" alt="BAC Legal Advisor" width={180} height={50} className="h-12 w-auto object-contain mx-auto mb-4" priority />
          <h1 className="text-2xl font-bold">Configura tu expediente</h1>
          <p className="text-sm text-bac-gray-text mt-1">Paso {paso} de 3</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {PASOS.map((p, i) => {
            const Icon = p.icon;
            const activo = i + 1 === paso;
            const completado = i + 1 < paso;
            return (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-0.5 ${completado ? "bg-bac-red" : "bg-bac-gray-border"}`} />}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  activo ? "bg-bac-red text-white" : completado ? "bg-bac-red/10 text-bac-red" : "bg-bac-gray-alt text-bac-gray-text"
                }`}>
                  {completado ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{p.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            {errors.map((e, i) => (
              <p key={i} className="text-sm text-red-700">{e}</p>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-bac-gray-border p-6 relative">
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-1.5 text-bac-gray-text hover:text-bac-red hover:bg-red-50 rounded-lg transition"
            title="Salir del wizard"
          >
            <X className="w-5 h-5" />
          </button>

          {paso === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Datos de tu empresa</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-bac-gray-text">
                    Nombre de empresa <span className="text-bac-red">*</span>
                  </label>
                  <input
                    className={`w-full mt-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30 ${
                      errors.length > 0 && !empresa.nombre_empresa.trim() ? "border-red-400 bg-red-50/50" : "border-bac-gray-border"
                    }`}
                    value={empresa.nombre_empresa}
                    onChange={(e) => setEmpresa({ ...empresa, nombre_empresa: e.target.value })}
                    placeholder="Nombre de tu empresa"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-bac-gray-text">RUC</label>
                  <input
                    className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    value={empresa.ruc}
                    onChange={(e) => setEmpresa({ ...empresa, ruc: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-bac-gray-text">Dirección</label>
                  <input
                    className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    value={empresa.direccion}
                    onChange={(e) => setEmpresa({ ...empresa, direccion: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-bac-gray-text">Teléfono</label>
                  <input
                    className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    value={empresa.telefono}
                    onChange={(e) => setEmpresa({ ...empresa, telefono: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-bac-gray-text">Sitio web</label>
                  <input
                    className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    value={empresa.web}
                    onChange={(e) => setEmpresa({ ...empresa, web: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-bac-gray-text">
                    Sector <span className="text-bac-red">*</span>
                  </label>
                  <select
                    className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    value={empresa.nicho}
                    onChange={(e) => setEmpresa({ ...empresa, nicho: e.target.value as NichoEnum })}
                  >
                    {SECTORES.map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                    {sectoresCustom.length > 0 && (
                      <optgroup label="Sectores personalizados">
                        {sectoresCustom.map((s) => (
                          <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-bac-gray-text">Tamaño</label>
                  <select
                    className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    value={empresa.tamano_empresa ?? ""}
                    onChange={(e) => setEmpresa({ ...empresa, tamano_empresa: (e.target.value || null) as TamanoEmpresaEnum | null })}
                  >
                    <option value="">Seleccionar</option>
                    {TAMANOS.map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Protección de datos</h2>
              <div>
                <label className="text-xs font-medium text-bac-gray-text">¿Tiene Delegado de Protección de Datos?</label>
                <select
                  className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                  value={proteccion.tiene_dpd ?? ""}
                  onChange={(e) => setProteccion({ ...proteccion, tiene_dpd: (e.target.value || null) as TieneDpdEnum | null })}
                >
                  <option value="">Seleccionar</option>
                  {DPD_OPTIONS.map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-bac-gray-text">
                  Tipo de DPD <span className="text-bac-red">*</span>
                </label>
                <select
                  className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                  value={proteccion.dpd_tipo ?? ""}
                  onChange={(e) => setProteccion({ ...proteccion, dpd_tipo: (e.target.value || null) as DpdTipoEnum | null })}
                >
                  <option value="">Seleccionar</option>
                  {Object.entries(DPD_TIPO_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-bac-gray-text mb-2 block">
                  ¿Tratas datos especiales? (selecciona los que apliquen)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DATOS_ESPECIALES.map((dato) => (
                    <label key={dato} className="flex items-center gap-2 p-2 rounded-lg border border-bac-gray-border hover:bg-bac-gray-alt cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        className="rounded border-bac-gray-border text-bac-red focus:ring-bac-red"
                        checked={proteccion.trata_datos_especiales.includes(dato)}
                        onChange={() => toggleDato(dato)}
                      />
                      {dato}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">Documentos iniciales</h2>
              <p className="text-sm text-bac-gray-text">
                Si ya tienes documentos de protección de datos, puedes subirlos ahora o hacerlo después.
              </p>
              <div className="bg-bac-gray-alt rounded-lg p-4 text-center">
                <FolderOpen className="w-10 h-10 text-bac-gray-text mx-auto mb-2" />
                <p className="text-sm font-medium">Este paso es opcional</p>
                <p className="text-xs text-bac-gray-text mt-1">
                  Podrás subir tus 12 documentos desde el módulo Documentos
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between mt-6">
          {paso > 1 ? (
            <button
              onClick={() => { setErrors([]); setPaso(paso - 1); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={guardarYAvanzar}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark disabled:opacity-60 transition"
          >
            {saving ? "Guardando..." : paso === 3 ? "Completar" : "Siguiente"}
            {paso < 3 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
