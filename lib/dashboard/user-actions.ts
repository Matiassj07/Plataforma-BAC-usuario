"use server";

import { revalidatePath } from "next/cache";
import { requireUser, requireCurrentUser } from "@/lib/auth";
import type { NichoEnum, TamanoEmpresaEnum, TieneDpdEnum, PersonalRolEnum, EtapaFlujoEnum } from "@/lib/types";
import { SECTOR_LABELS } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sincronizarArchivoCliente } from "./almacenamiento-sync";

const ORDEN_ETAPAS: EtapaFlujoEnum[] = [
  "sin_iniciar", "docs_completos", "rat_completado", "riesgos_completados",
  "plan_implementacion", "dpd_completado", "auditado",
];

const SCORE_POR_ETAPA: Record<EtapaFlujoEnum, number> = {
  sin_iniciar: 0, onboarding: 0, docs_completos: 30, rat_completado: 60,
  riesgos_completados: 90, plan_implementacion: 95, dpd_completado: 99, auditado: 100,
};

async function avanzarFlujoAutomatico(profileId: string, etapaDestino: EtapaFlujoEnum, motivo: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("flujo_estados").select("etapa").eq("profile_id", profileId).maybeSingle();
  const etapaActual = (data?.etapa as EtapaFlujoEnum) ?? null;
  const idxActual = etapaActual && etapaActual !== "onboarding" ? ORDEN_ETAPAS.indexOf(etapaActual) : 0;
  const idxDestino = ORDEN_ETAPAS.indexOf(etapaDestino);
  if (idxDestino > (idxActual >= 0 ? idxActual : 0)) {
    await supabase.from("flujo_estados").upsert(
      { profile_id: profileId, etapa: etapaDestino, updated_at: new Date().toISOString() },
      { onConflict: "profile_id" }
    );
    const mes = new Date().toISOString().slice(0, 7);
    await supabase.from("score_historial").upsert(
      { profile_id: profileId, score: SCORE_POR_ETAPA[etapaDestino], mes },
      { onConflict: "profile_id,mes" }
    );
    await supabase.from("historial_acciones").insert({
      profile_id: profileId, accion: `${motivo} — score actualizado a ${SCORE_POR_ETAPA[etapaDestino]}%`, modulo: "Flujo",
    });
  }
}

async function requireEscritura() {
  const cu = await requireCurrentUser();
  if (cu.type === "personal" && cu.effectiveRol === "cliente") {
    throw new Error("Tu cuenta tiene acceso de solo lectura.");
  }
  return cu.profile;
}

export async function actualizarPerfil(data: {
  nombre_empresa: string;
  ruc?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  web?: string | null;
  nicho: NichoEnum;
  tamano_empresa: TamanoEmpresaEnum | null;
  tiene_dpd: TieneDpdEnum | null;
  dpd_tipo?: "interno" | "externo" | null;
  trata_datos_especiales: string[] | null;
}) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  let nichoValue: string = data.nicho;
  let sectorLabel = (SECTOR_LABELS as Record<string, string>)[data.nicho] ?? null;

  if (!sectorLabel) {
    const { data: custom } = await supabase
      .from("sectores_custom")
      .select("nombre")
      .eq("id", data.nicho)
      .single();
    if (custom) {
      sectorLabel = custom.nombre;
      nichoValue = "otros";
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      nombre_empresa: data.nombre_empresa,
      ruc: data.ruc ?? null,
      direccion: data.direccion ?? null,
      telefono: data.telefono ?? null,
      web: data.web ?? null,
      nicho: nichoValue,
      sector: sectorLabel,
      tamano_empresa: data.tamano_empresa,
      tiene_dpd: data.tiene_dpd,
      dpd_tipo: data.dpd_tipo ?? null,
      dpd_activo: data.dpd_tipo === "interno",
      trata_datos_especiales: data.trata_datos_especiales,
      ultima_actividad: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function completarOnboarding(paso: number) {
  const user = await requireUser();
  const supabase = createAdminClient();

  const updates: Record<string, any> = {
    onboarding_paso: paso,
    ultima_actividad: new Date().toISOString(),
  };

  if (paso >= 5) {
    updates.onboarding_completado = true;
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function subirDocumentoUsuario(formData: FormData) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const file = formData.get("file") as File;
  const tipoDocumento = formData.get("tipo_documento") as string;
  if (!file || !tipoDocumento) throw new Error("Archivo y tipo de documento requeridos");

  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_SIZE) throw new Error("El archivo no puede superar los 10 MB");

  const ALLOWED_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
  const ALLOWED_EXTS = ["pdf", "doc", "docx", "xls", "xlsx"];
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXTS.includes(ext) && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Tipo de archivo no permitido. Usa PDF, DOC, DOCX, XLS o XLSX.");
  }

  const path = `${user.id}/documentos/${tipoDocumento}.${ext}`;

  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { data: existing } = await supabase
    .from("documentos_generales")
    .select("id")
    .eq("profile_id", user.id)
    .eq("tipo_documento", tipoDocumento)
    .single();

  let docId: string;
  if (existing) {
    const { error: updErr } = await supabase
      .from("documentos_generales")
      .update({
        nombre_archivo: file.name,
        url_storage: path,
        fecha_subida: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (updErr) throw new Error(updErr.message);
    docId = existing.id;
  } else {
    const { data: newDoc, error: insErr } = await supabase.from("documentos_generales").insert({
      profile_id: user.id,
      tipo_documento: tipoDocumento,
      nombre_archivo: file.name,
      url_storage: path,
      fecha_subida: new Date().toISOString(),
    }).select("id").single();
    if (insErr) throw new Error(insErr.message);
    docId = newDoc.id;
  }

  revalidatePath("/dashboard/documentos");
  revalidatePath("/dashboard");
  return { docId };
}

export async function eliminarDocumentoUsuario(docId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: doc } = await supabase
    .from("documentos_generales")
    .select("url_storage")
    .eq("id", docId)
    .eq("profile_id", user.id)
    .single();
  if (!doc) throw new Error("Documento no encontrado");

  if (doc.url_storage) {
    await supabase.storage.from("documentos").remove([doc.url_storage]);
  }

  const { error } = await supabase
    .from("documentos_generales")
    .delete()
    .eq("id", docId)
    .eq("profile_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/documentos");
  revalidatePath("/dashboard");
}

export async function crearEmpleado(data: {
  nombre: string;
  cargo: string;
  area: string;
  fecha_renovacion?: string | null;
  email: string;
  password: string;
  rol: PersonalRolEnum;
}) {
  const user = await requireEscritura();
  const admin = createAdminClient();

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { is_personal: true },
  });
  if (authError) throw new Error(authError.message);

  const supabase = createAdminClient();
  const { error } = await supabase.from("personal").insert({
    profile_id: user.id,
    nombre: data.nombre,
    cargo: data.cargo,
    area: data.area,
    fecha_renovacion: data.fecha_renovacion || null,
    email: data.email,
    auth_user_id: authUser.user.id,
    rol: data.rol,
  });

  if (error) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/personal");
}

export async function actualizarEmpleado(
  id: string,
  data: {
    nombre: string;
    cargo: string;
    area: string;
    fecha_renovacion?: string | null;
    rol: PersonalRolEnum;
    password?: string;
  }
) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("personal")
    .select("auth_user_id")
    .eq("id", id)
    .eq("profile_id", user.id)
    .single();
  if (!existing) throw new Error("Empleado no encontrado");

  if (data.password && existing.auth_user_id) {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(existing.auth_user_id, {
      password: data.password,
    });
  }

  const { error } = await supabase
    .from("personal")
    .update({
      nombre: data.nombre,
      cargo: data.cargo,
      area: data.area,
      fecha_renovacion: data.fecha_renovacion || null,
      rol: data.rol,
    })
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/personal");
}

export async function eliminarEmpleado(id: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("personal")
    .select("auth_user_id")
    .eq("id", id)
    .eq("profile_id", user.id)
    .single();

  if (existing?.auth_user_id) {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(existing.auth_user_id);
  }

  const { error } = await supabase
    .from("personal")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/personal");
}

const BUCKETS_PERMITIDOS = new Set(["documentos", "ejemplos-documentos"]);

export async function obtenerUrlDescarga(bucket: string, path: string) {
  const user = await requireUser();
  if (!BUCKETS_PERMITIDOS.has(bucket)) {
    throw new Error("Bucket no permitido");
  }
  if (bucket !== "ejemplos-documentos" && !path.startsWith(`${user.id}/`)) {
    throw new Error("No tienes acceso a este archivo");
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function completarActividadDpd(actividadId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: act } = await supabase
    .from("dpd_actividades")
    .select("plan_id")
    .eq("id", actividadId)
    .single();
  if (!act) throw new Error("Actividad no encontrada");

  const { data: plan } = await supabase
    .from("dpd_planes")
    .select("id")
    .eq("id", act.plan_id)
    .eq("profile_id", user.id)
    .single();
  if (!plan) throw new Error("Plan no encontrado");

  const { error } = await supabase
    .from("dpd_actividades")
    .update({ completada: true, fecha_completado: new Date().toISOString() })
    .eq("id", actividadId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/dpd");
  revalidatePath("/dashboard");
}

export async function crearActaNoConformidad(planId: string, datos: {
  descripcion_hallazgo: string;
  recomendacion: string;
}) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: plan } = await supabase
    .from("dpd_planes")
    .select("id")
    .eq("id", planId)
    .eq("profile_id", user.id)
    .single();
  if (!plan) throw new Error("Plan no encontrado");

  const { count } = await supabase
    .from("dpd_actas")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId);

  const num = (count ?? 0) + 1;
  const numero_acta = `ACTA-${String(num).padStart(3, "0")}`;

  const { error } = await supabase.from("dpd_actas").insert({
    plan_id: planId,
    numero_acta,
    descripcion_hallazgo: datos.descripcion_hallazgo,
    recomendacion: datos.recomendacion,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/dpd");
}

export async function descompletarActividadDpd(actividadId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: act } = await supabase
    .from("dpd_actividades")
    .select("plan_id")
    .eq("id", actividadId)
    .single();
  if (!act) throw new Error("Actividad no encontrada");

  const { data: plan } = await supabase
    .from("dpd_planes")
    .select("id")
    .eq("id", act.plan_id)
    .eq("profile_id", user.id)
    .single();
  if (!plan) throw new Error("Plan no encontrado");

  const { error } = await supabase
    .from("dpd_actividades")
    .update({ completada: false, fecha_completado: null })
    .eq("id", actividadId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/dpd");
  revalidatePath("/dashboard");
}

export async function crearRatCompleto(
  datosResponsable: Record<string, string>,
  datosDpd: Record<string, string>,
  actividades: Record<string, any>[]
) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: ultima } = await supabase
    .from("rat_versiones")
    .select("version")
    .eq("profile_id", user.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: version, error } = await supabase
    .from("rat_versiones")
    .insert({
      profile_id: user.id,
      version: (ultima?.version ?? 0) + 1,
      datos_responsable: datosResponsable,
      datos_dpd: datosDpd,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  let actividadIds: string[] = [];
  if (actividades.length > 0) {
    const { data: actData, error: actError } = await supabase
      .from("actividades_rat")
      .insert(actividades.map((a) => {
        const CAMPOS_RAT = new Set([
          "nombre_actividad", "categoria", "descripcion", "base_legal",
          "finalidad", "tipo_dato", "origen_datos", "categoria_interesados",
          "cesion_datos", "transferencia_internacional", "medidas_seguridad",
          "plazo_conservacion", "observaciones",
        ]);
        const limpio: Record<string, unknown> = { rat_version_id: version.id };
        for (const [k, v] of Object.entries(a)) {
          if (CAMPOS_RAT.has(k)) limpio[k] = v;
        }
        return limpio;
      }))
      .select("id");
    if (actError) throw new Error(actError.message);
    actividadIds = (actData ?? []).map((a) => a.id);
  }

  await avanzarFlujoAutomatico(user.id, "rat_completado", "RAT creado — avance automático a rat_completado");
  revalidatePath("/dashboard/rat");
  revalidatePath("/dashboard");
  return { versionId: version.id, actividadIds };
}

export async function crearMatrizCompleta(
  actividades: Record<string, any>[]
) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: ultima } = await supabase
    .from("matriz_riesgos")
    .select("version")
    .eq("profile_id", user.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: matriz, error } = await supabase
    .from("matriz_riesgos")
    .insert({
      profile_id: user.id,
      version: (ultima?.version ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  let actividadIds: string[] = [];
  if (actividades.length > 0) {
    const { data: inserted, error: actError } = await supabase
      .from("actividades_riesgo")
      .insert(actividades.map((a) => {
        const CAMPOS_RIESGO = new Set([
          "activo_informacion", "amenaza", "vulnerabilidad",
          "probabilidad", "impacto", "control_existente",
          "tipo_control", "probabilidad_residual", "impacto_residual",
        ]);
        const limpio: Record<string, unknown> = { matriz_id: matriz.id };
        for (const [k, v] of Object.entries(a)) {
          if (CAMPOS_RIESGO.has(k)) limpio[k] = v;
        }
        return limpio;
      }))
      .select("id");
    if (actError) throw new Error(actError.message);
    actividadIds = (inserted ?? []).map((r: any) => r.id as string);
  }

  await avanzarFlujoAutomatico(user.id, "riesgos_completados", "Matriz de riesgos creada — avance automático a riesgos_completados");
  revalidatePath("/dashboard/riesgos");
  revalidatePath("/dashboard");
  return { matrizId: matriz.id, actividadIds };
}

export async function crearPlanDpd(datos: {
  nombre_dpd: string;
  correo_dpd: string;
  periodo_inicio: string;
  periodo_fin: string;
}, formData?: FormData) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  let urlPlanAdjunto: string | null = null;
  const file = formData?.get("file") as File | null;
  if (file && file.size > 0) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const path = `${user.id}/dpd-plan-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("documentos").upload(path, file);
    if (uploadError) throw new Error(uploadError.message);
    urlPlanAdjunto = path;
  }

  const { error } = await supabase.from("dpd_planes").insert({
    profile_id: user.id,
    creado_por: user.id,
    ...datos,
    url_plan_adjunto: urlPlanAdjunto,
  });
  if (error) throw new Error(error.message);
  await avanzarFlujoAutomatico(user.id, "dpd_completado", "Plan DPD creado — avance automático a dpd_completado");
  revalidatePath("/dashboard/dpd");
  revalidatePath("/dashboard");
}

export async function crearActividadDpd(planId: string, datos: {
  mes: number;
  fase: string;
  descripcion: string;
  verificacion?: string;
}) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: plan } = await supabase
    .from("dpd_planes")
    .select("id")
    .eq("id", planId)
    .eq("profile_id", user.id)
    .single();
  if (!plan) throw new Error("Plan no encontrado");

  const { error } = await supabase.from("dpd_actividades").insert({
    plan_id: planId,
    ...datos,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/dpd");
}

export async function subirActaFirmada(actaId: string, formData: FormData) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: acta } = await supabase
    .from("dpd_actas")
    .select("id, plan_id")
    .eq("id", actaId)
    .single();
  if (!acta) throw new Error("Acta no encontrada");

  const { data: plan } = await supabase
    .from("dpd_planes")
    .select("id")
    .eq("id", acta.plan_id)
    .eq("profile_id", user.id)
    .single();
  if (!plan) throw new Error("Acta no pertenece a tu plan");

  const file = formData.get("file") as File;
  if (!file) throw new Error("Archivo requerido");

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) throw new Error("El archivo no puede superar los 10 MB");

  const ALLOWED_EXTS = ["pdf", "doc", "docx", "xls", "xlsx"];
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) {
    throw new Error("Tipo de archivo no permitido. Usa PDF, DOC, DOCX, XLS o XLSX.");
  }

  const path = `${user.id}/actas/${actaId}_firmada.${ext}`;

  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase
    .from("dpd_actas")
    .update({
      url_acta_firmada: path,
      estado: "firmada",
    })
    .eq("id", actaId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/dpd");
}

export async function cambiarPasswordUsuario(passwordActual: string, passwordNueva: string) {
  const user = await requireUser();
  const supabase = createClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: passwordActual,
  });
  if (signInError) throw new Error("La contraseña actual es incorrecta.");

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(user.id, {
    password: passwordNueva,
  });
  if (error) throw new Error(error.message);
}

// ── Carpetas de documentos ──

export async function crearCarpeta(nombre: string, carpetaPadreId?: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { error } = await supabase.from("carpetas_documentos").insert({
    profile_id: user.id,
    nombre,
    created_by: user.id,
    ...(carpetaPadreId ? { carpeta_padre_id: carpetaPadreId } : {}),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/documentos");
}

export async function eliminarCarpeta(carpetaId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: carpeta } = await supabase
    .from("carpetas_documentos")
    .select("id")
    .eq("id", carpetaId)
    .eq("profile_id", user.id)
    .single();
  if (!carpeta) throw new Error("Carpeta no encontrada");

  const { data: docs } = await supabase
    .from("documentos_carpeta")
    .select("url_storage")
    .eq("carpeta_id", carpetaId);

  if (docs && docs.length > 0) {
    const paths = docs.map((d) => d.url_storage).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from("documentos").remove(paths);
    }
  }

  const { error } = await supabase
    .from("carpetas_documentos")
    .delete()
    .eq("id", carpetaId)
    .eq("profile_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/documentos");
}

export async function subirDocCarpeta(carpetaId: string, formData: FormData) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: carpeta } = await supabase
    .from("carpetas_documentos")
    .select("id")
    .eq("id", carpetaId)
    .eq("profile_id", user.id)
    .single();
  if (!carpeta) throw new Error("Carpeta no encontrada");

  const file = formData.get("file") as File;
  if (!file) throw new Error("Archivo requerido");

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) throw new Error("El archivo no puede superar los 10 MB");

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const ALLOWED_EXTS = ["pdf", "doc", "docx", "xls", "xlsx"];
  if (!ALLOWED_EXTS.includes(ext)) throw new Error("Tipo de archivo no permitido. Usa PDF, DOC, DOCX, XLS o XLSX.");

  const path = `${user.id}/carpetas/${carpetaId}/${Date.now()}.${ext}`;

  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(path, buffer, { contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const nombrePersonalizado = (formData.get("nombreArchivo") as string | null)?.trim();
  const nombreFinal = nombrePersonalizado || file.name;

  const { data: docInserted, error } = await supabase.from("documentos_carpeta").insert({
    carpeta_id: carpetaId,
    nombre_archivo: nombreFinal,
    url_storage: path,
    subido_por: user.id,
  }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/documentos");
  return { docId: docInserted.id };
}

export async function subirDocCarpetaObligatoria(nombreCarpeta: string, formData: FormData) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  let { data: carpeta } = await supabase
    .from("carpetas_documentos")
    .select("id")
    .eq("profile_id", user.id)
    .eq("nombre", nombreCarpeta)
    .maybeSingle();

  if (!carpeta) {
    const { data: nueva, error: createErr } = await supabase
      .from("carpetas_documentos")
      .insert({ profile_id: user.id, nombre: nombreCarpeta })
      .select("id")
      .single();
    if (createErr) throw new Error(createErr.message);
    carpeta = nueva;
  }

  const file = formData.get("file") as File;
  if (!file) throw new Error("Archivo requerido");

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) throw new Error("El archivo no puede superar los 10 MB");

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const ALLOWED_EXTS = ["pdf", "doc", "docx", "xls", "xlsx"];
  if (!ALLOWED_EXTS.includes(ext)) throw new Error("Tipo de archivo no permitido. Usa PDF, DOC, DOCX, XLS o XLSX.");

  const path = `${user.id}/carpetas/${carpeta.id}/${Date.now()}.${ext}`;

  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("documentos")
    .upload(path, buffer, { contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const nombrePersonalizado = (formData.get("nombreArchivo") as string | null)?.trim();
  const nombreFinal = nombrePersonalizado || file.name;

  const { data: doc, error } = await supabase.from("documentos_carpeta").insert({
    carpeta_id: carpeta.id,
    nombre_archivo: nombreFinal,
    url_storage: path,
    subido_por: user.id,
  }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/documentos");
  return { docId: doc.id as string };
}

// ── Edición in-place de RAT ──

const CAMPOS_RAT_PERMITIDOS = new Set([
  "departamento", "nombre_actividad", "finalidad", "categoria_datos",
  "categorias_especiales", "perfiles_automatizados", "categorias_titulares",
  "origen_datos", "base_licitud", "articulo_lopdp", "almacenamiento",
  "plazo_conservacion", "destinatarios", "transferencias_internacionales",
  "medidas_seguridad", "activo_informacion",
]);

export async function actualizarActividadRat(
  actividadId: string,
  campo: string,
  valor: unknown
) {
  const user = await requireEscritura();
  if (!CAMPOS_RAT_PERMITIDOS.has(campo)) throw new Error("Campo no permitido");
  const supabase = createAdminClient();

  const { data: act } = await supabase
    .from("actividades_rat")
    .select("rat_version_id")
    .eq("id", actividadId)
    .single();
  if (!act) throw new Error("Actividad no encontrada");

  const { data: ver } = await supabase
    .from("rat_versiones")
    .select("id")
    .eq("id", act.rat_version_id)
    .eq("profile_id", user.id)
    .single();
  if (!ver) throw new Error("No tienes acceso a esta actividad");

  const { data: current } = await supabase
    .from("actividades_rat")
    .select(campo)
    .eq("id", actividadId)
    .single();
  const valorAnterior = current ? String((current as any)[campo] ?? "") : "";
  const valorNuevo = String(valor ?? "");

  if (valorAnterior !== valorNuevo) {
    const { data: cambios } = await supabase
      .from("rat_cambios_campo")
      .select("id, version_cambio")
      .eq("actividad_rat_id", actividadId)
      .eq("campo", campo)
      .order("version_cambio", { ascending: true });

    const lista = cambios ?? [];
    if (lista.length >= 2) {
      await supabase.from("rat_cambios_campo").delete().eq("id", lista[0].id);
      await supabase.from("rat_cambios_campo").update({ version_cambio: 1 }).eq("id", lista[1].id);
      await supabase.from("rat_cambios_campo").insert({
        actividad_rat_id: actividadId,
        campo,
        valor_anterior: valorAnterior,
        valor_nuevo: valorNuevo,
        version_cambio: 2,
      });
    } else {
      await supabase.from("rat_cambios_campo").insert({
        actividad_rat_id: actividadId,
        campo,
        valor_anterior: valorAnterior,
        valor_nuevo: valorNuevo,
        version_cambio: lista.length + 1,
      });
    }
  }

  const { error } = await supabase
    .from("actividades_rat")
    .update({ [campo]: valor })
    .eq("id", actividadId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/rat");
}

export async function agregarActividadRat(
  versionId: string,
  datos?: Record<string, string>
) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: ver } = await supabase
    .from("rat_versiones")
    .select("id")
    .eq("id", versionId)
    .eq("profile_id", user.id)
    .single();
  if (!ver) throw new Error("Versión no encontrada");

  const insertData: Record<string, unknown> = { rat_version_id: versionId };
  if (datos) {
    for (const [k, v] of Object.entries(datos)) {
      if (CAMPOS_RAT_PERMITIDOS.has(k) && v && typeof v === "string" && v.trim()) insertData[k] = v.trim();
    }
  }
  if (!insertData.nombre_actividad) insertData.nombre_actividad = "Nueva actividad";
  const { data: inserted, error } = await supabase.from("actividades_rat").insert(insertData).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/rat");
  return inserted.id as string;
}

export async function eliminarActividadRat(actividadId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: act } = await supabase
    .from("actividades_rat")
    .select("rat_version_id")
    .eq("id", actividadId)
    .single();
  if (!act) throw new Error("Actividad no encontrada");

  const { data: ver } = await supabase
    .from("rat_versiones")
    .select("id")
    .eq("id", act.rat_version_id)
    .eq("profile_id", user.id)
    .single();
  if (!ver) throw new Error("No tienes acceso");

  const { error } = await supabase
    .from("actividades_rat")
    .delete()
    .eq("id", actividadId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/rat");
}

// ── Edición in-place de Riesgos ──

const CAMPOS_RIESGO_PERMITIDOS = new Set([
  "area_departamento", "actividad_tratamiento", "cat_especiales_gran_escala",
  "obs_sistematica_publica", "trat_automatizado", "activos_relacionados",
  "base_legal", "articulo_ley", "amenazas", "vulnerabilidades",
  "medidas_implementadas", "probabilidad", "impacto", "requiere_eipd",
  "medidas_implementar", "prob_residual", "imp_residual",
  "responsable_implementacion",
]);

export async function actualizarActividadRiesgo(
  actividadId: string,
  campo: string,
  valor: unknown
) {
  const user = await requireEscritura();
  if (!CAMPOS_RIESGO_PERMITIDOS.has(campo)) throw new Error("Campo no permitido");
  const supabase = createAdminClient();

  const { data: act } = await supabase
    .from("actividades_riesgo")
    .select("matriz_id")
    .eq("id", actividadId)
    .single();
  if (!act) throw new Error("Actividad no encontrada");

  const { data: mat } = await supabase
    .from("matriz_riesgos")
    .select("id")
    .eq("id", act.matriz_id)
    .eq("profile_id", user.id)
    .single();
  if (!mat) throw new Error("No tienes acceso");

  const updates: Record<string, unknown> = { [campo]: valor };

  if (campo === "probabilidad" || campo === "impacto") {
    const { data: row } = await supabase
      .from("actividades_riesgo")
      .select("probabilidad, impacto")
      .eq("id", actividadId)
      .single();
    if (row) {
      const prob = campo === "probabilidad" ? Number(valor) : row.probabilidad;
      const imp = campo === "impacto" ? Number(valor) : row.impacto;
      if (prob && imp) {
        updates.riesgo_inherente = prob * imp;
        const r = prob * imp;
        updates.nivel_riesgo = r >= 20 ? "critico" : r >= 12 ? "alto" : r >= 6 ? "medio" : r >= 3 ? "bajo" : "muy_bajo";
      }
    }
  }

  if (campo === "prob_residual" || campo === "imp_residual") {
    const { data: row } = await supabase
      .from("actividades_riesgo")
      .select("prob_residual, imp_residual")
      .eq("id", actividadId)
      .single();
    if (row) {
      const prob = campo === "prob_residual" ? Number(valor) : row.prob_residual;
      const imp = campo === "imp_residual" ? Number(valor) : row.imp_residual;
      if (prob && imp) {
        updates.riesgo_residual = prob * imp;
        const r = prob * imp;
        updates.nivel_riesgo_residual = r >= 20 ? "critico" : r >= 12 ? "alto" : r >= 6 ? "medio" : r >= 3 ? "bajo" : "muy_bajo";
      }
    }
  }

  // Track per-field change history (FIFO, max 2 changes)
  const { data: currentRiesgo } = await supabase
    .from("actividades_riesgo")
    .select("*")
    .eq("id", actividadId)
    .single();
  const valorAnterior = currentRiesgo ? String((currentRiesgo as any)[campo] ?? "") : "";
  const valorNuevo = String(valor ?? "");
  if (valorAnterior !== valorNuevo) {
    const { data: cambios } = await supabase
      .from("riesgo_cambios_campo")
      .select("id, version_cambio")
      .eq("actividad_riesgo_id", actividadId)
      .eq("campo", campo)
      .order("version_cambio", { ascending: true });
    const lista = cambios ?? [];
    if (lista.length >= 2) {
      await supabase.from("riesgo_cambios_campo").delete().eq("id", lista[0].id);
      await supabase.from("riesgo_cambios_campo").update({ version_cambio: 1 }).eq("id", lista[1].id);
      await supabase.from("riesgo_cambios_campo").insert({
        actividad_riesgo_id: actividadId, campo, valor_anterior: valorAnterior, valor_nuevo: valorNuevo, version_cambio: 2,
      });
    } else {
      await supabase.from("riesgo_cambios_campo").insert({
        actividad_riesgo_id: actividadId, campo, valor_anterior: valorAnterior, valor_nuevo: valorNuevo, version_cambio: lista.length + 1,
      });
    }
  }

  const { error } = await supabase
    .from("actividades_riesgo")
    .update(updates)
    .eq("id", actividadId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/riesgos");
}

export async function agregarActividadRiesgo(
  matrizId: string,
  datos?: Record<string, string>
) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: mat } = await supabase
    .from("matriz_riesgos")
    .select("id")
    .eq("id", matrizId)
    .eq("profile_id", user.id)
    .single();
  if (!mat) throw new Error("Matriz no encontrada");

  const { count } = await supabase
    .from("actividades_riesgo")
    .select("id", { count: "exact", head: true })
    .eq("matriz_id", matrizId);
  const num = count ?? 0;
  const insertData: Record<string, unknown> = {
    matriz_id: matrizId,
    codigo: `RIES-${String(num + 1).padStart(2, "0")}`,
  };
  if (datos) {
    for (const [k, v] of Object.entries(datos)) {
      if (CAMPOS_RIESGO_PERMITIDOS.has(k) && v && typeof v === "string" && v.trim()) insertData[k] = v.trim();
    }
  }
  const { data: inserted, error } = await supabase.from("actividades_riesgo").insert(insertData).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/riesgos");
  return inserted.id as string;
}

export async function eliminarActividadRiesgo(actividadId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: act } = await supabase
    .from("actividades_riesgo")
    .select("matriz_id")
    .eq("id", actividadId)
    .single();
  if (!act) throw new Error("Actividad no encontrada");

  const { data: mat } = await supabase
    .from("matriz_riesgos")
    .select("id")
    .eq("id", act.matriz_id)
    .eq("profile_id", user.id)
    .single();
  if (!mat) throw new Error("No tienes acceso");

  const { error } = await supabase
    .from("actividades_riesgo")
    .delete()
    .eq("id", actividadId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/riesgos");
}

// ── Eliminación universal (user-scoped) ──

export async function eliminarVersionRat(versionId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();
  const { data: ver } = await supabase
    .from("rat_versiones")
    .select("id")
    .eq("id", versionId)
    .eq("profile_id", user.id)
    .single();
  if (!ver) throw new Error("No tienes acceso a esta versión");
  await supabase.from("actividades_rat").delete().eq("rat_version_id", versionId);
  const { error } = await supabase.from("rat_versiones").delete().eq("id", versionId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/rat");
}

export async function eliminarMatrizRiesgos(matrizId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();
  const { data: mat } = await supabase
    .from("matriz_riesgos")
    .select("id")
    .eq("id", matrizId)
    .eq("profile_id", user.id)
    .single();
  if (!mat) throw new Error("No tienes acceso a esta matriz");
  await supabase.from("actividades_riesgo").delete().eq("matriz_id", matrizId);
  const { error } = await supabase.from("matriz_riesgos").delete().eq("id", matrizId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/riesgos");
}

export async function cambiarEstadoBrecha(brechaId: string, nuevoEstado: "abierta" | "cerrada") {
  const user = await requireEscritura();
  const supabase = createAdminClient();
  const { data: brecha } = await supabase
    .from("brechas_seguridad")
    .select("id")
    .eq("id", brechaId)
    .eq("profile_id", user.id)
    .single();
  if (!brecha) throw new Error("No tienes acceso a esta brecha");
  const { error } = await supabase
    .from("brechas_seguridad")
    .update({ estado: nuevoEstado })
    .eq("id", brechaId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/dpd");
}

export async function editarBrecha(brechaId: string, data: { tipo_incidente: string; descripcion: string }) {
  const user = await requireEscritura();
  const supabase = createAdminClient();
  const { data: brecha } = await supabase
    .from("brechas_seguridad")
    .select("id")
    .eq("id", brechaId)
    .eq("profile_id", user.id)
    .single();
  if (!brecha) throw new Error("No tienes acceso a esta brecha");
  const { error } = await supabase
    .from("brechas_seguridad")
    .update({ tipo_incidente: data.tipo_incidente, descripcion: data.descripcion })
    .eq("id", brechaId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/dpd");
}

export async function eliminarBrecha(brechaId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();
  const { data: brecha } = await supabase
    .from("brechas_seguridad")
    .select("id, tipo_incidente")
    .eq("id", brechaId)
    .eq("profile_id", user.id)
    .single();
  if (!brecha) throw new Error("No tienes acceso a esta brecha");
  const { error } = await supabase.from("brechas_seguridad").delete().eq("id", brechaId);
  if (error) throw new Error(error.message);
  if (brecha.tipo_incidente?.startsWith("Brecha detectada — ")) {
    const partes = brecha.tipo_incidente.replace("Brecha detectada — ", "").split(" ");
    const mes = partes[0];
    const anio = parseInt(partes[1]);
    if (mes && !isNaN(anio)) {
      await supabase
        .from("dpd_informes_brechas")
        .delete()
        .eq("mes", mes)
        .eq("anio", anio)
        .eq("hubo_brecha", true)
        .in("plan_id",
          (await supabase.from("dpd_planes").select("id").eq("profile_id", user.id)).data?.map((p: any) => p.id) ?? []
        );
    }
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/dpd");
}

export async function eliminarPlanDpd(planId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();
  const { data: plan } = await supabase
    .from("dpd_planes")
    .select("id")
    .eq("id", planId)
    .eq("profile_id", user.id)
    .single();
  if (!plan) throw new Error("No tienes acceso a este plan");
  await supabase.from("dpd_actas").delete().eq("plan_id", planId);
  await supabase.from("dpd_actividades").delete().eq("plan_id", planId);
  const { error } = await supabase.from("dpd_planes").delete().eq("id", planId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/dpd");
}

export async function eliminarActividadDpd(actividadId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();
  const { data: act } = await supabase
    .from("dpd_actividades")
    .select("id, plan_id, dpd_planes!inner(profile_id)")
    .eq("id", actividadId)
    .single();
  if (!act || (act as any).dpd_planes?.profile_id !== user.id) throw new Error("No tienes acceso");
  await supabase.from("dpd_actas").update({ actividad_id: null }).eq("actividad_id", actividadId);
  const { error } = await supabase.from("dpd_actividades").delete().eq("id", actividadId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/dpd");
}

export async function eliminarActaDpd(actaId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();
  const { data: acta } = await supabase
    .from("dpd_actas")
    .select("id, plan_id, dpd_planes!inner(profile_id)")
    .eq("id", actaId)
    .single();
  if (!acta || (acta as any).dpd_planes?.profile_id !== user.id) throw new Error("No tienes acceso");
  const { error } = await supabase.from("dpd_actas").delete().eq("id", actaId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/dpd");
}

export async function crearInformeBrechaDpd(datos: {
  plan_id: string;
  mes: string;
  anio: number;
  hubo_brecha: boolean;
  contenido: string;
}) {
  const user = await requireEscritura();
  const supabase = createAdminClient();
  const { data: plan } = await supabase
    .from("dpd_planes")
    .select("id")
    .eq("id", datos.plan_id)
    .eq("profile_id", user.id)
    .single();
  if (!plan) throw new Error("No tienes acceso a este plan");
  const { error } = await supabase.from("dpd_informes_brechas").insert({
    plan_id: datos.plan_id,
    mes: datos.mes,
    anio: datos.anio,
    hubo_brecha: datos.hubo_brecha,
    contenido: datos.contenido,
  });
  if (error) throw new Error(error.message);

  if (datos.hubo_brecha) {
    await supabase.from("brechas_seguridad").insert({
      profile_id: user.id,
      tipo_incidente: `Brecha detectada — ${datos.mes} ${datos.anio}`,
      descripcion: datos.contenido,
      fecha_deteccion: new Date().toISOString().slice(0, 10),
      estado: "abierta",
    });
  }

  revalidatePath("/dashboard/dpd");
}

export async function editarInformeBrechaDpd(
  informeId: string,
  datos: { mes: string; anio: number; hubo_brecha: boolean; contenido: string }
) {
  const user = await requireEscritura();
  const supabase = createAdminClient();
  const { data: informe } = await supabase
    .from("dpd_informes_brechas")
    .select("id, plan_id, dpd_planes!inner(profile_id)")
    .eq("id", informeId)
    .single();
  if (!informe || (informe as any).dpd_planes?.profile_id !== user.id) throw new Error("No tienes acceso");
  const { error } = await supabase
    .from("dpd_informes_brechas")
    .update({
      mes: datos.mes,
      anio: datos.anio,
      hubo_brecha: datos.hubo_brecha,
      contenido: datos.contenido,
    })
    .eq("id", informeId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/dpd");
}

export async function eliminarInformeBrechaDpd(informeId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();
  const { data: informe } = await supabase
    .from("dpd_informes_brechas")
    .select("id, mes, anio, hubo_brecha, plan_id, dpd_planes!inner(profile_id)")
    .eq("id", informeId)
    .single();
  if (!informe || (informe as any).dpd_planes?.profile_id !== user.id) throw new Error("No tienes acceso");
  const { error } = await supabase.from("dpd_informes_brechas").delete().eq("id", informeId);
  if (error) throw new Error(error.message);
  if (informe.hubo_brecha) {
    await supabase
      .from("brechas_seguridad")
      .delete()
      .eq("profile_id", user.id)
      .eq("tipo_incidente", `Brecha detectada — ${informe.mes} ${informe.anio}`);
  }
  revalidatePath("/dashboard/dpd");
}

export async function renombrarDocCarpeta(docId: string, nuevoNombre: string) {
  const user = await requireEscritura();
  const nombre = nuevoNombre.trim();
  if (!nombre) throw new Error("El nombre no puede estar vacío.");
  const supabase = createAdminClient();

  const { data: doc } = await supabase
    .from("documentos_carpeta")
    .select("id, carpeta_id")
    .eq("id", docId)
    .single();
  if (!doc) throw new Error("Documento no encontrado");

  const { data: carpeta } = await supabase
    .from("carpetas_documentos")
    .select("id")
    .eq("id", doc.carpeta_id)
    .eq("profile_id", user.id)
    .single();
  if (!carpeta) throw new Error("No tienes acceso a este documento");

  const { error } = await supabase
    .from("documentos_carpeta")
    .update({ nombre_archivo: nombre })
    .eq("id", docId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/documentos");
  revalidatePath("/dashboard/rat");
}

export async function eliminarDocCarpeta(docId: string) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const { data: doc } = await supabase
    .from("documentos_carpeta")
    .select("id, url_storage, carpeta_id")
    .eq("id", docId)
    .single();
  if (!doc) throw new Error("Documento no encontrado");

  const { data: carpeta } = await supabase
    .from("carpetas_documentos")
    .select("id")
    .eq("id", doc.carpeta_id)
    .eq("profile_id", user.id)
    .single();
  if (!carpeta) throw new Error("No tienes acceso a este documento");

  if (doc.url_storage) {
    await supabase.storage.from("documentos").remove([doc.url_storage]);
  }

  const { error } = await supabase
    .from("documentos_carpeta")
    .delete()
    .eq("id", docId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/documentos");
  revalidatePath("/dashboard/rat");
}

export async function vincularDocAActividadRat(
  docId: string,
  actividadRatId: string,
  nombreActividad: string
) {
  const user = await requireEscritura();
  const supabase = createAdminClient();
  const { data: doc } = await supabase
    .from("documentos_carpeta")
    .select("id, carpeta_id, carpetas_documentos!inner(profile_id)")
    .eq("id", docId)
    .single();
  if (!doc || (doc as any).carpetas_documentos?.profile_id !== user.id) throw new Error("No autorizado");
  const { error } = await supabase
    .from("documentos_carpeta")
    .update({ actividad_rat_id: actividadRatId, nombre_actividad_rat: nombreActividad })
    .eq("id", docId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/documentos");
  revalidatePath("/dashboard/rat");
}

export async function vincularDocGeneralAActividadRat(
  docId: string,
  actividadRatId: string,
  nombreActividad: string
) {
  const user = await requireEscritura();
  const supabase = createAdminClient();
  const { data: doc } = await supabase
    .from("documentos_generales")
    .select("id")
    .eq("id", docId)
    .eq("profile_id", user.id)
    .single();
  if (!doc) throw new Error("No autorizado");
  const { error } = await supabase
    .from("documentos_generales")
    .update({ actividad_rat_id: actividadRatId, nombre_actividad_rat: nombreActividad })
    .eq("id", docId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/documentos");
  revalidatePath("/dashboard/rat");
}

export async function reemplazarDocCarpeta(docId: string, formData: FormData) {
  const user = await requireEscritura();
  const supabase = createAdminClient();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Selecciona un archivo.");
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const ALLOWED_EXTS = ["pdf", "doc", "docx", "xls", "xlsx"];
  if (!ALLOWED_EXTS.includes(ext)) throw new Error("Tipo de archivo no permitido. Usa PDF, DOC, DOCX, XLS o XLSX.");

  const { data: docActual } = await supabase
    .from("documentos_carpeta")
    .select("id, carpeta_id, doc_original_id, version, url_storage, actividad_rat_id, nombre_actividad_rat")
    .eq("id", docId)
    .single();
  if (!docActual) throw new Error("Documento no encontrado.");

  const { data: carpeta } = await supabase
    .from("carpetas_documentos")
    .select("id")
    .eq("id", docActual.carpeta_id)
    .eq("profile_id", user.id)
    .single();
  if (!carpeta) throw new Error("No tienes acceso a este documento");

  const originalId = docActual.doc_original_id ?? docActual.id;

  const { data: versiones } = await supabase
    .from("documentos_carpeta")
    .select("id, version, url_storage")
    .or(`id.eq.${originalId},doc_original_id.eq.${originalId}`)
    .order("version", { ascending: true });

  const lista = versiones ?? [];

  if (lista.length >= 3) {
    const masAntigua = lista[0];
    if (masAntigua.url_storage) {
      await supabase.storage.from("documentos").remove([masAntigua.url_storage]);
    }
    await supabase.from("documentos_carpeta").delete().eq("id", masAntigua.id);
    for (let i = 1; i < lista.length; i++) {
      await supabase
        .from("documentos_carpeta")
        .update({ version: lista[i].version - 1 })
        .eq("id", lista[i].id);
    }
  }

  const nuevaVersion = lista.length >= 3 ? 3 : lista.length + 1;
  const path = `${user.id}/carpetas/${docActual.carpeta_id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("documentos").upload(path, file);
  if (uploadError) throw new Error(uploadError.message);

  const nombrePersonalizado = (formData.get("nombreArchivo") as string | null)?.trim();
  const nombreFinal = nombrePersonalizado || file.name;
  sincronizarArchivoCliente(user.id, nombreFinal, path).catch((e) => console.error("[sync]", e));

  const { error } = await supabase.from("documentos_carpeta").insert({
    carpeta_id: docActual.carpeta_id,
    nombre_archivo: nombreFinal,
    url_storage: path,
    subido_por: user.id,
    version: nuevaVersion,
    doc_original_id: originalId === docActual.id ? docActual.id : originalId,
    actividad_rat_id: docActual.actividad_rat_id ?? null,
    nombre_actividad_rat: docActual.nombre_actividad_rat ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/documentos");
  revalidatePath("/dashboard/rat");
}

export async function subirDocRatEnCarpeta(
  actividadId: string,
  nombreActividad: string,
  carpetaNombre: string,
  formData: FormData
) {
  const user = await requireEscritura();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Selecciona un archivo.");
  if (file.size > 10 * 1024 * 1024) throw new Error("El archivo no puede superar los 10 MB");
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const ALLOWED_EXTS = ["pdf", "doc", "docx", "xls", "xlsx"];
  if (!ALLOWED_EXTS.includes(ext)) throw new Error("Tipo de archivo no permitido. Usa PDF, DOC, DOCX, XLS o XLSX.");

  const supabase = createAdminClient();

  const { data: actividad } = await supabase
    .from("actividades_rat")
    .select("id, rat_version_id, rat_versiones!inner(profile_id)")
    .eq("id", actividadId)
    .single();
  if (!actividad) throw new Error("Actividad no encontrada.");
  const profileId = (actividad as any).rat_versiones?.profile_id;
  if (profileId !== user.id) throw new Error("No tienes acceso a esta actividad.");

  let { data: carpeta } = await supabase
    .from("carpetas_documentos")
    .select("id")
    .eq("profile_id", user.id)
    .eq("nombre", carpetaNombre)
    .maybeSingle();

  if (!carpeta) {
    const { data: newCarpeta, error: carpetaErr } = await supabase
      .from("carpetas_documentos")
      .insert({ profile_id: user.id, nombre: carpetaNombre, created_by: user.id })
      .select("id")
      .single();
    if (carpetaErr) throw new Error(carpetaErr.message);
    carpeta = newCarpeta;
  }

  const path = `${user.id}/carpetas/${carpeta!.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("documentos").upload(path, file);
  if (uploadError) throw new Error(uploadError.message);

  const nombrePersonalizado = (formData.get("nombreArchivo") as string | null)?.trim();
  const nombreFinal = nombrePersonalizado || file.name;
  sincronizarArchivoCliente(user.id, nombreFinal, path).catch((e) => console.error("[sync]", e));

  const { error } = await supabase.from("documentos_carpeta").insert({
    carpeta_id: carpeta!.id,
    nombre_archivo: nombreFinal,
    url_storage: path,
    subido_por: user.id,
    actividad_rat_id: actividadId,
    nombre_actividad_rat: nombreActividad,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/rat");
  revalidatePath("/dashboard/documentos");
}

export async function crearPlanUsuario(datos: {
  tipo: "rat" | "riesgos" | "documentos";
  actividad_origen_id?: string;
  titulo: string;
  responsable?: string;
  departamento?: string;
  actividad_nombre?: string;
  actividad_realizar?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}) {
  const profile = await requireEscritura();
  const supabase = createAdminClient();
  const { error } = await supabase.from("planes_implementacion").insert({
    profile_id: profile.id,
    tipo: datos.tipo,
    actividad_origen_id: datos.actividad_origen_id ?? null,
    titulo: datos.titulo,
    responsable: datos.responsable ?? null,
    departamento: datos.departamento ?? null,
    actividad_nombre: datos.actividad_nombre ?? null,
    actividad_realizar: datos.actividad_realizar ?? null,
    fecha_inicio: datos.fecha_inicio ?? null,
    fecha_fin: datos.fecha_fin ?? null,
    estado: "pendiente",
  });
  if (error) throw new Error(error.message);
  await avanzarFlujoAutomatico(profile.id, "plan_implementacion", "Plan de implementación creado — avance automático");
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/rat");
  revalidatePath("/dashboard/riesgos");
}

export async function actualizarPlanUsuario(planId: string, datos: {
  titulo?: string;
  responsable?: string;
  departamento?: string;
  actividad_nombre?: string;
  actividad_realizar?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  estado?: string;
}) {
  const profile = await requireEscritura();
  const supabase = createAdminClient();
  const CAMPOS_PERMITIDOS = new Set([
    "titulo", "responsable", "departamento", "actividad_nombre",
    "actividad_realizar", "fecha_inicio", "fecha_fin", "estado",
  ]);
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(datos)) {
    if (CAMPOS_PERMITIDOS.has(k) && v !== undefined) safe[k] = v;
  }
  if (Object.keys(safe).length === 0) return;
  const { error } = await supabase
    .from("planes_implementacion")
    .update(safe)
    .eq("id", planId)
    .eq("profile_id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/plan");
}

export async function eliminarPlanUsuario(planId: string) {
  const profile = await requireEscritura();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("planes_implementacion")
    .delete()
    .eq("id", planId)
    .eq("profile_id", profile.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/plan");
  revalidatePath("/dashboard/rat");
  revalidatePath("/dashboard/riesgos");
}

export async function obtenerUrlDescargaActa(path: string): Promise<string> {
  const profile = await requireUser();
  if (!path.startsWith(`actas-entrega/${profile.id}/`)) {
    throw new Error("Acceso no autorizado.");
  }
  const supabase = createAdminClient();
  const { data } = await supabase.storage
    .from("documentos")
    .createSignedUrl(path, 60);
  if (!data?.signedUrl) throw new Error("No se pudo generar URL de descarga.");
  return data.signedUrl;
}

export async function subirActaFirmadaCliente(formData: FormData) {
  const profile = await requireUser();
  const file = formData.get("file") as File;
  if (!file) throw new Error("No se proporcionó archivo.");

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `actas-entrega/${profile.id}/firmada-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from("documentos").upload(path, file);
  if (upErr) throw new Error(upErr.message);

  await supabase
    .from("actas_entrega")
    .update({ url_acta_firmada: path, updated_at: new Date().toISOString() })
    .eq("profile_id", profile.id);

  await supabase.from("historial_acciones").insert({
    profile_id: profile.id,
    accion: "Acta firmada subida por cliente",
    modulo: "Documentos",
  });

  revalidatePath("/dashboard/documentos");
}
