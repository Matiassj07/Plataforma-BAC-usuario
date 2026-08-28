"use client";

import { useState } from "react";
import { UserCircle, Save, Eye, EyeOff, Lock } from "lucide-react";
import { actualizarPerfil, cambiarPasswordUsuario } from "@/lib/dashboard/user-actions";
import { SECTOR_LABELS, TAMANO_LABELS, TIENE_DPD_LABELS } from "@/lib/types";
import { formatearFecha } from "@/lib/utils";
import type { NichoEnum, TamanoEmpresaEnum, TieneDpdEnum, TipoUsuarioEnum } from "@/lib/types";

const SECTORES = Object.entries(SECTOR_LABELS) as [NichoEnum, string][];
const TAMANOS = Object.entries(TAMANO_LABELS) as [TamanoEmpresaEnum, string][];
const DPD_OPTIONS = Object.entries(TIENE_DPD_LABELS) as [TieneDpdEnum, string][];

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
  email: string;
  tipo_usuario: TipoUsuarioEnum;
  es_pro: boolean;
  created_at: string;
}

export default function PerfilClient({ initialProfile }: { initialProfile: InitialProfile }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    nombre_empresa: initialProfile.nombre_empresa,
    ruc: initialProfile.ruc,
    direccion: initialProfile.direccion,
    telefono: initialProfile.telefono,
    web: initialProfile.web,
    nicho: initialProfile.nicho,
    tamano_empresa: initialProfile.tamano_empresa,
    tiene_dpd: initialProfile.tiene_dpd,
    trata_datos_especiales: initialProfile.trata_datos_especiales,
  });

  const [pwForm, setPwForm] = useState({ actual: "", nueva: "", confirmar: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [showActual, setShowActual] = useState(false);
  const [showNueva, setShowNueva] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await actualizarPerfil(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);

    if (pwForm.nueva.length < 8) {
      setPwMsg({ tipo: "error", texto: "La nueva contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (pwForm.nueva !== pwForm.confirmar) {
      setPwMsg({ tipo: "error", texto: "Las contraseñas no coinciden." });
      return;
    }

    setPwSaving(true);
    try {
      await cambiarPasswordUsuario(pwForm.actual, pwForm.nueva);
      setPwMsg({ tipo: "ok", texto: "Contraseña actualizada correctamente." });
      setPwForm({ actual: "", nueva: "", confirmar: "" });
    } catch (err: any) {
      setPwMsg({ tipo: "error", texto: err.message });
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
          <p className="text-sm text-bac-gray-text mt-1">
            Datos de tu empresa y configuración
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark disabled:opacity-60 transition"
        >
          <Save className="w-4 h-4" />
          {saving ? "Guardando..." : saved ? "Guardado" : "Guardar cambios"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-bac-gray-border p-6 space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-bac-gray-border">
          <div className="w-16 h-16 bg-bac-red rounded-full flex items-center justify-center">
            <UserCircle className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="font-semibold text-lg">{form.nombre_empresa || "Mi empresa"}</p>
            <p className="text-sm text-bac-gray-text">{initialProfile.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pb-6 border-b border-bac-gray-border">
          <div className="bg-bac-gray-alt rounded-lg p-3">
            <span className="text-xs text-bac-gray-text">Tipo de usuario</span>
            <p className="text-sm font-medium mt-0.5">
              {initialProfile.tipo_usuario === "interno_bac" ? "Interno BAC" : initialProfile.tipo_usuario === "cliente_externo" ? "Cliente externo" : "Revendedor"}
            </p>
          </div>
          <div className="bg-bac-gray-alt rounded-lg p-3">
            <span className="text-xs text-bac-gray-text">Estado PRO</span>
            <p className="text-sm font-medium mt-0.5">{initialProfile.es_pro ? "Activo" : "No"}</p>
          </div>
          <div className="bg-bac-gray-alt rounded-lg p-3">
            <span className="text-xs text-bac-gray-text">Fecha de registro</span>
            <p className="text-sm font-medium mt-0.5">{formatearFecha(initialProfile.created_at)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-bac-gray-text">
              Nombre de empresa <span className="text-bac-red">*</span>
            </label>
            <input
              className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
              value={form.nombre_empresa}
              onChange={(e) => setForm({ ...form, nombre_empresa: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-bac-gray-text">RUC</label>
            <input
              className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
              value={form.ruc}
              onChange={(e) => setForm({ ...form, ruc: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-bac-gray-text">Dirección</label>
            <input
              className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
              value={form.direccion}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-bac-gray-text">Teléfono</label>
            <input
              className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-bac-gray-text">Sitio web</label>
            <input
              className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
              value={form.web}
              onChange={(e) => setForm({ ...form, web: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-bac-gray-text">
              Sector <span className="text-bac-red">*</span>
            </label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
              value={form.nicho}
              onChange={(e) => setForm({ ...form, nicho: e.target.value as NichoEnum })}
            >
              {SECTORES.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-bac-gray-text">Tamaño de empresa</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
              value={form.tamano_empresa ?? ""}
              onChange={(e) => setForm({ ...form, tamano_empresa: (e.target.value || null) as TamanoEmpresaEnum | null })}
            >
              <option value="">Seleccionar</option>
              {TAMANOS.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-bac-gray-text">¿Tiene DPD?</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
              value={form.tiene_dpd ?? ""}
              onChange={(e) => setForm({ ...form, tiene_dpd: (e.target.value || null) as TieneDpdEnum | null })}
            >
              <option value="">Seleccionar</option>
              {DPD_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cambiar contraseña */}
      <div className="bg-white rounded-xl border border-bac-gray-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-bac-gray-text" />
          <h2 className="text-lg font-semibold text-gray-900">Cambiar contraseña</h2>
        </div>

        <form onSubmit={handleCambiarPassword} className="space-y-4 max-w-md">
          <div>
            <label className="text-xs font-medium text-bac-gray-text">Contraseña actual</label>
            <div className="relative mt-1">
              <input
                type={showActual ? "text" : "password"}
                value={pwForm.actual}
                onChange={(e) => setPwForm({ ...pwForm, actual: e.target.value })}
                required
                className="w-full px-3 py-2 pr-10 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
              />
              <button
                type="button"
                onClick={() => setShowActual(!showActual)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-bac-gray-text hover:text-gray-700"
              >
                {showActual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-bac-gray-text">Nueva contraseña</label>
            <div className="relative mt-1">
              <input
                type={showNueva ? "text" : "password"}
                value={pwForm.nueva}
                onChange={(e) => setPwForm({ ...pwForm, nueva: e.target.value })}
                required
                minLength={8}
                className="w-full px-3 py-2 pr-10 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
              />
              <button
                type="button"
                onClick={() => setShowNueva(!showNueva)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-bac-gray-text hover:text-gray-700"
              >
                {showNueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-bac-gray-text">Confirmar nueva contraseña</label>
            <input
              type="password"
              value={pwForm.confirmar}
              onChange={(e) => setPwForm({ ...pwForm, confirmar: e.target.value })}
              required
              className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
            />
          </div>

          {pwMsg && (
            <p className={`text-sm ${pwMsg.tipo === "ok" ? "text-green-600" : "text-bac-score-rojo"}`}>
              {pwMsg.texto}
            </p>
          )}

          <button
            type="submit"
            disabled={pwSaving || !pwForm.actual || !pwForm.nueva || !pwForm.confirmar}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark disabled:opacity-60 transition"
          >
            <Lock className="w-4 h-4" />
            {pwSaving ? "Cambiando..." : "Cambiar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
