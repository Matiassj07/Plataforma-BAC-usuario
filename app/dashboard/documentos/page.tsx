import { requireCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import DocumentosClient from "@/components/dashboard/DocumentosClient";

export const dynamic = "force-dynamic";

export default async function DocumentosPage() {
  const cu = await requireCurrentUser();
  const supabase = createAdminClient();

  const [{ data }, { data: carpetasData }, { data: carpetasEjemploData }, { data: docsEjemploAll }, { data: ratData }, { data: actaData }] = await Promise.all([
    supabase
      .from("documentos_generales")
      .select("id, tipo_documento, slug_requerido, nombre_archivo, url_storage")
      .eq("profile_id", cu.profile.id),
    supabase
      .from("carpetas_documentos")
      .select("id, nombre, created_at, carpeta_padre_id, documentos_carpeta(id, nombre_archivo, url_storage, fecha_subida, actividad_rat_id, nombre_actividad_rat, version, doc_original_id)")
      .eq("profile_id", cu.profile.id)
      .order("created_at", { ascending: true }),
    supabase.rpc("select_carpetas_ejemplo"),
    supabase
      .from("documentos_ejemplo")
      .select("slug, nombre_archivo, url_storage, carpeta_ejemplo_id")
      .not("carpeta_ejemplo_id", "is", null),
    supabase
      .from("rat_versiones")
      .select("actividades_rat(id, nombre_actividad)")
      .eq("profile_id", cu.profile.id)
      .order("version", { ascending: false })
      .limit(1),
    supabase
      .from("actas_entrega")
      .select("*")
      .eq("profile_id", cu.profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const allDocs = (data ?? []) as any[];
  const docsSubidos = allDocs
    .filter((d) => d.tipo_documento !== "rat_actividad")
    .map((d: any) => ({
      id: d.id,
      tipo_documento: d.slug_requerido || d.tipo_documento,
      nombre_archivo: d.nombre_archivo ?? "",
      url_storage: d.url_storage,
    }));

  const allCarpetas = (carpetasData ?? []).map((c: any) => ({
    id: c.id,
    nombre: c.nombre,
    created_at: c.created_at,
    carpeta_padre_id: c.carpeta_padre_id ?? null,
    documentos: (c.documentos_carpeta ?? []).map((d: any) => ({
      id: d.id,
      nombre_archivo: d.nombre_archivo,
      url_storage: d.url_storage,
      fecha_subida: d.fecha_subida,
      actividad_rat_id: d.actividad_rat_id ?? null,
      nombre_actividad_rat: d.nombre_actividad_rat ?? null,
      version: d.version ?? 1,
      doc_original_id: d.doc_original_id ?? null,
    })),
    subcarpetas: [] as any[],
  }));
  const carpetaMap = new Map(allCarpetas.map((c) => [c.id, c]));
  const carpetas: typeof allCarpetas = [];
  for (const c of allCarpetas) {
    if (c.carpeta_padre_id && carpetaMap.has(c.carpeta_padre_id)) {
      carpetaMap.get(c.carpeta_padre_id)!.subcarpetas.push(c);
    } else {
      carpetas.push(c);
    }
  }

  const allFolderDocs = (docsEjemploAll ?? []) as any[];
  const carpetasEjemplo = (carpetasEjemploData ?? []).map((c: any) => ({
    id: c.id,
    nombre: c.nombre,
    documentos: allFolderDocs
      .filter((d: any) => d.carpeta_ejemplo_id === c.id)
      .map((d: any) => ({
        slug: d.slug,
        nombre_archivo: d.nombre_archivo,
        url_storage: d.url_storage,
      })),
  }));

  const canEdit = cu.type === "profile" || cu.effectiveRol !== "cliente";
  const canCreateFolders = cu.type === "profile" || cu.effectiveRol === "contador";

  const actividadesRat = ((ratData?.[0]?.actividades_rat ?? []) as any[]).map((a: any, i: number) => ({
    id: a.id as string,
    index: i + 1,
    nombre: (a.nombre_actividad as string) ?? `Actividad ${i + 1}`,
  }));

  const acta = actaData ? {
    id: actaData.id as string,
    url_acta: actaData.url_acta as string | null,
    url_acta_firmada: actaData.url_acta_firmada as string | null,
    estado_implementacion: actaData.estado_implementacion as string,
    completada: actaData.completada as boolean,
  } : null;

  return (
    <DocumentosClient
      initialDocsSubidos={docsSubidos}
      ejemplos={[]}
      soloLectura={!canEdit}
      carpetas={carpetas}
      canCreateFolders={canCreateFolders}
      carpetasEjemplo={carpetasEjemplo}
      actividadesRat={actividadesRat}
      acta={acta}
    />
  );
}
