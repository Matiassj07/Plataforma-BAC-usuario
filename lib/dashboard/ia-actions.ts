"use server";

import { requireCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const COSTO_POR_ANALISIS = "x";

async function requireProUser() {
  const cu = await requireCurrentUser();
  if (cu.type === "personal" && cu.effectiveRol === "cliente") {
    throw new Error("Tu cuenta tiene acceso de solo lectura.");
  }
  const supabase = createAdminClient();
  const { data: config } = await supabase.from("bac_config").select("pro_global_activo").maybeSingle();
  if (!cu.profile.pro_aprobado_por_admin || !config?.pro_global_activo) {
    throw new Error("La funcionalidad PRO no está habilitada para tu cuenta.");
  }
  return cu.profile;
}

async function callIA(prompt: string, datos: unknown): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("AI_API_KEY no está configurada.");
  }

  const provider = process.env.AI_PROVIDER ?? "openai";
  const model = process.env.AI_MODEL ?? "gpt-4o";

  let url: string;
  let headers: Record<string, string>;
  let body: unknown;

  if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
    body = {
      model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nDatos:\n${JSON.stringify(datos, null, 2)}`,
        },
      ],
    };
  } else {
    url = process.env.AI_BASE_URL ?? "https://api.openai.com/v1/chat/completions";
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    body = {
      model,
      messages: [
        {
          role: "system",
          content: "Eres un experto en protección de datos personales y cumplimiento de la LOPDP de Ecuador. Responde siempre en español y en formato JSON válido.",
        },
        {
          role: "user",
          content: `${prompt}\n\nDatos:\n${JSON.stringify(datos, null, 2)}`,
        },
      ],
      temperature: 0.3,
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error del proveedor de IA (${res.status}): ${err}`);
  }

  const json = await res.json();

  if (provider === "anthropic") {
    return json.content?.[0]?.text ?? "";
  }
  return json.choices?.[0]?.message?.content ?? "";
}

export async function analizarRatConIA(ratVersionId: string) {
  const profile = await requireProUser();
  const supabase = createAdminClient();

  const { data: version } = await supabase
    .from("rat_versiones")
    .select("id, profile_id")
    .eq("id", ratVersionId)
    .single();

  if (!version || version.profile_id !== profile.id) {
    throw new Error("No tienes acceso a esta versión del RAT.");
  }

  const { data: actividades } = await supabase
    .from("actividades_rat")
    .select("*")
    .eq("rat_version_id", ratVersionId);

  if (!actividades || actividades.length === 0) {
    throw new Error("No hay actividades en esta versión del RAT para analizar.");
  }

  const prompt = `Analiza el siguiente Registro de Actividades de Tratamiento (RAT) según la LOPDP de Ecuador.

Para cada actividad de tratamiento, identifica:
1. Brechas de cumplimiento (campos faltantes, bases de licitud incorrectas, medidas de seguridad insuficientes, etc.)
2. Severidad de cada brecha: "critica", "media" o "baja"
3. Artículo de la LOPDP que aplica
4. Recomendación específica para corregir la brecha

Responde ÚNICAMENTE con un JSON válido con esta estructura:
{
  "brechas": [
    {
      "campo": "nombre del campo o actividad afectada",
      "descripcion": "descripción de la brecha encontrada",
      "severidad": "critica|media|baja",
      "articulo_lopdp": "artículo aplicable",
      "recomendacion": "acción correctiva recomendada"
    }
  ],
  "resumen": "resumen general del análisis",
  "score_cumplimiento": 0-100
}`;

  const respuesta = await callIA(prompt, actividades);

  let resultado;
  try {
    const jsonMatch = respuesta.match(/\{[\s\S]*\}/);
    resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(respuesta);
  } catch {
    throw new Error("La IA no devolvió un formato válido. Intenta de nuevo.");
  }

  revalidatePath("/dashboard/rat");

  return {
    brechas: resultado.brechas ?? [],
    resumen: resultado.resumen ?? "",
    score: resultado.score_cumplimiento ?? null,
    costo: COSTO_POR_ANALISIS,
  };
}

export async function analizarMatrizConIA(matrizId: string) {
  const profile = await requireProUser();
  const supabase = createAdminClient();

  const { data: matriz } = await supabase
    .from("matriz_riesgos")
    .select("id, profile_id")
    .eq("id", matrizId)
    .single();

  if (!matriz || matriz.profile_id !== profile.id) {
    throw new Error("No tienes acceso a esta matriz de riesgos.");
  }

  const { data: actividades } = await supabase
    .from("actividades_riesgo")
    .select("*")
    .eq("matriz_id", matrizId);

  if (!actividades || actividades.length === 0) {
    throw new Error("No hay actividades en esta matriz de riesgos para analizar.");
  }

  const prompt = `Analiza la siguiente Matriz de Riesgos según la LOPDP de Ecuador.

Para cada actividad de riesgo, evalúa:
1. Si la probabilidad e impacto asignados son realistas
2. Si las medidas de mitigación existentes son suficientes
3. Si las nuevas medidas propuestas son adecuadas
4. Si se requiere EIPD y no está marcada
5. Riesgos subestimados o sobreestimados

Responde ÚNICAMENTE con un JSON válido con esta estructura:
{
  "hallazgos": [
    {
      "actividad": "nombre de la actividad analizada",
      "problema": "descripción del hallazgo",
      "severidad": "critica|media|baja",
      "tipo": "riesgo_subestimado|mitigacion_insuficiente|eipd_requerida|medida_inadecuada",
      "recomendacion": "acción correctiva recomendada"
    }
  ],
  "resumen": "resumen general del análisis de la matriz",
  "riesgos_criticos": 0,
  "score_madurez": 0
}`;

  const respuesta = await callIA(prompt, actividades);

  let resultado;
  try {
    const jsonMatch = respuesta.match(/\{[\s\S]*\}/);
    resultado = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(respuesta);
  } catch {
    throw new Error("La IA no devolvió un formato válido. Intenta de nuevo.");
  }

  revalidatePath("/dashboard/riesgos");

  return {
    hallazgos: resultado.hallazgos ?? [],
    resumen: resultado.resumen ?? "",
    riesgosCriticos: resultado.riesgos_criticos ?? 0,
    score: resultado.score_madurez ?? null,
    costo: COSTO_POR_ANALISIS,
  };
}
