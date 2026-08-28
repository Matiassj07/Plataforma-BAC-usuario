"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Pencil, Trash2, Key, Copy, Check } from "lucide-react";
import { crearEmpleado, actualizarEmpleado, eliminarEmpleado } from "@/lib/dashboard/user-actions";
import { formatearFecha } from "@/lib/utils";
import type { PersonalRolEnum } from "@/lib/types";

const ROL_DESCRIPTIONS: Record<PersonalRolEnum, string> = {
  contador: "Creación de carpetas, estructura y asignación de usuarios. No puede crear usuarios.",
  asistente: "Revisión de repositorio y carga de documentos.",
  cliente: "Acceso solo visual a repositorio.",
};

interface Empleado {
  id: string;
  nombre: string;
  cargo: string;
  area: string;
  fecha_renovacion: string | null;
  email: string | null;
  rol: string | null;
  auth_user_id: string | null;
}

interface Props {
  initialEmpleados: Empleado[];
  soloLectura?: boolean;
}

function generarPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let pw = "";
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export default function PersonalClient({ initialEmpleados, soloLectura }: Props) {
  const router = useRouter();
  const [empleados, setEmpleados] = useState<Empleado[]>(initialEmpleados);
  useEffect(() => { setEmpleados(initialEmpleados); }, [initialEmpleados]);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Empleado | null>(null);
  const [saving, setSaving] = useState(false);
  const [credenciales, setCredenciales] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    cargo: "",
    area: "",
    fecha_renovacion: "",
    email: "",
    password: "",
    rol: "cliente" as PersonalRolEnum,
  });

  function openNew() {
    setEditando(null);
    setForm({
      nombre: "", cargo: "", area: "", fecha_renovacion: "",
      email: "", password: generarPassword(), rol: "cliente",
    });
    setShowModal(true);
  }

  function openEdit(emp: Empleado) {
    setEditando(emp);
    setForm({
      nombre: emp.nombre,
      cargo: emp.cargo,
      area: emp.area,
      fecha_renovacion: emp.fecha_renovacion ?? "",
      email: emp.email ?? "",
      password: "",
      rol: (emp.rol as PersonalRolEnum) ?? "cliente",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.nombre.trim()) { alert("El nombre es obligatorio"); return; }
    if (!editando && !form.email.trim()) { alert("El email es obligatorio"); return; }
    if (!editando && !form.password) { alert("La contraseña es obligatoria"); return; }

    setSaving(true);
    try {
      if (editando) {
        await actualizarEmpleado(editando.id, {
          nombre: form.nombre,
          cargo: form.cargo,
          area: form.area,
          fecha_renovacion: form.fecha_renovacion || null,
          rol: form.rol,
          password: form.password || undefined,
        });
      } else {
        await crearEmpleado({
          nombre: form.nombre,
          cargo: form.cargo,
          area: form.area,
          fecha_renovacion: form.fecha_renovacion || null,
          email: form.email,
          password: form.password,
          rol: form.rol,
        });
        setCredenciales({ email: form.email, password: form.password });
      }
      setShowModal(false);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este empleado? Se eliminará también su acceso al sistema.")) return;
    try {
      await eliminarEmpleado(id);
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    }
  }

  function handleCopyCredenciales() {
    if (!credenciales) return;
    navigator.clipboard.writeText(`Email: ${credenciales.email}\nContraseña: ${credenciales.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const rolBadge = (rol: string | null) => {
    const colors: Record<string, string> = {
      contador: "bg-blue-100 text-blue-700",
      asistente: "bg-amber-100 text-amber-700",
      cliente: "bg-gray-100 text-gray-600",
    };
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[rol ?? "cliente"] ?? colors.cliente}`}>
        {rol ?? "cliente"}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Personal</h1>
          <p className="text-sm text-bac-gray-text mt-1">
            Registro de empleados con acceso a datos personales
          </p>
        </div>
        {!soloLectura && (
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-bac-red text-white rounded-lg hover:bg-bac-red-dark transition"
          >
            <Plus className="w-4 h-4" />
            Agregar empleado
          </button>
        )}
      </div>

      {empleados.length === 0 ? (
        <div className="bg-white rounded-xl border border-bac-gray-border p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Sin personal registrado</h3>
          <p className="mt-2 text-sm text-bac-gray-text max-w-md mx-auto">
            Registra a los empleados que tienen acceso a datos personales en tu empresa.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-bac-gray-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bac-gray-alt">
                  <th className="text-left px-4 py-2.5 font-medium text-bac-gray-text">Nombre</th>
                  <th className="text-left px-4 py-2.5 font-medium text-bac-gray-text">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium text-bac-gray-text">Rol</th>
                  <th className="text-left px-4 py-2.5 font-medium text-bac-gray-text">Cargo</th>
                  <th className="text-left px-4 py-2.5 font-medium text-bac-gray-text">Área</th>
                  <th className="text-left px-4 py-2.5 font-medium text-bac-gray-text">Renovación</th>
                  {!soloLectura && <th className="text-left px-4 py-2.5 font-medium text-bac-gray-text">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {empleados.map((emp) => (
                  <tr key={emp.id} className="border-b border-bac-gray-border last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{emp.nombre}</td>
                    <td className="px-4 py-3 text-bac-gray-text text-xs">{emp.email ?? "—"}</td>
                    <td className="px-4 py-3">{rolBadge(emp.rol)}</td>
                    <td className="px-4 py-3 text-bac-gray-text">{emp.cargo}</td>
                    <td className="px-4 py-3 text-bac-gray-text">{emp.area}</td>
                    <td className="px-4 py-3 text-bac-gray-text text-xs">{emp.fecha_renovacion ? formatearFecha(emp.fecha_renovacion) : "—"}</td>
                    {!soloLectura && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(emp)} className="p-1.5 text-bac-gray-text hover:text-bac-red rounded transition" title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-bac-gray-text hover:text-red-600 rounded transition" title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editando ? "Editar empleado" : "Nuevo empleado"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-bac-gray-text">Nombre completo *</label>
                <input
                  className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>

              {!editando && (
                <div>
                  <label className="text-xs font-medium text-bac-gray-text">Email *</label>
                  <input
                    type="email"
                    className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-bac-gray-text">
                  {editando ? "Nueva contraseña" : "Contraseña *"}
                </label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30 font-mono"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, password: generarPassword() })}
                    className="px-3 py-2 text-xs font-medium border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt"
                  >
                    <Key className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-bac-gray-text">Rol *</label>
                <select
                  className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30 bg-white"
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value as PersonalRolEnum })}
                >
                  <option value="contador">Contador</option>
                  <option value="asistente">Asistente</option>
                  <option value="cliente">Cliente</option>
                </select>
                <p className="text-[10px] text-bac-gray-text mt-1">{ROL_DESCRIPTIONS[form.rol]}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-bac-gray-text">Cargo</label>
                  <input
                    className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    value={form.cargo}
                    onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-bac-gray-text">Área</label>
                  <input
                    className="w-full mt-1 px-3 py-2 text-sm border border-bac-gray-border rounded-lg focus:outline-none focus:ring-2 focus:ring-bac-red/30"
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                  />
                </div>
              </div>

            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-bac-red text-white rounded-lg hover:bg-bac-red-dark disabled:opacity-60">
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de credenciales creadas */}
      {credenciales && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Empleado creado</h3>
            <p className="text-sm text-bac-gray-text mb-4">Guarda estas credenciales. La contraseña no se puede recuperar después.</p>
            <div className="bg-bac-gray-alt rounded-lg p-4 font-mono text-sm space-y-1">
              <p><span className="text-bac-gray-text">Email:</span> {credenciales.email}</p>
              <p><span className="text-bac-gray-text">Contraseña:</span> {credenciales.password}</p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={handleCopyCredenciales}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-bac-gray-border rounded-lg hover:bg-bac-gray-alt"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button
                onClick={() => setCredenciales(null)}
                className="px-4 py-2 text-sm bg-bac-red text-white rounded-lg hover:bg-bac-red-dark"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
