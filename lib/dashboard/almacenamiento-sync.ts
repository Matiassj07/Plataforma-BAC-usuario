import { createAdminClient } from "@/lib/supabase/admin";

interface OAuthTokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
}

function microsoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID ?? "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? "";
  return { clientId, clientSecret, configured: !!(clientId && clientSecret) };
}

async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const { clientId, clientSecret } = microsoftConfig();
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description ?? "Microsoft refresh failed");
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + (json.expires_in ?? 3600),
  };
}

async function uploadToMicrosoft(
  accessToken: string,
  carpetaDestino: string,
  fileName: string,
  fileContent: Uint8Array,
) {
  let folderPath = carpetaDestino;
  try {
    const parsed = new URL(folderPath);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const docIdx = segments.findIndex((s) => s.toLowerCase() === "documents");
    folderPath = docIdx >= 0 ? segments.slice(docIdx).join("/") : segments.slice(-1).join("/") || "BAC";
  } catch {
    // Not a URL — use as-is
  }
  folderPath = folderPath.replace(/^\/+|\/+$/g, "");
  const endpoint = `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}/${fileName}:/content`;
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: fileContent as unknown as BodyInit,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message ?? "OneDrive upload failed");
}

async function getValidToken(integrationId: string) {
  const supabase = createAdminClient();
  const { data: integ } = await supabase
    .from("integraciones_almacenamiento")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (!integ || !integ.access_token) throw new Error("Integración no conectada.");
  if (!integ.activo) throw new Error("Integración desactivada.");

  const ahora = Math.floor(Date.now() / 1000);
  const expira = integ.token_expira ? Math.floor(new Date(integ.token_expira).getTime() / 1000) : 0;

  if (expira > 0 && ahora >= expira - 60 && integ.refresh_token) {
    const tokens = await refreshAccessToken(integ.refresh_token);
    await supabase.from("integraciones_almacenamiento").update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expira: new Date(tokens.expires_at * 1000).toISOString(),
    }).eq("id", integrationId);
    return { token: tokens.access_token, carpeta: integ.carpeta_destino ?? "" };
  }

  return { token: integ.access_token, carpeta: integ.carpeta_destino ?? "" };
}

/**
 * Syncs a newly uploaded file to all active Microsoft integrations.
 * Called internally after client uploads — no admin auth required.
 */
export async function sincronizarArchivoCliente(
  clienteId: string,
  fileName: string,
  storagePath: string,
) {
  const supabase = createAdminClient();

  const { data: integraciones } = await supabase
    .from("integraciones_almacenamiento")
    .select("*")
    .eq("activo", true)
    .eq("sync_automatica", true);

  if (!integraciones || integraciones.length === 0) return;

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre_empresa")
    .eq("id", clienteId)
    .single();

  const carpetaCliente = perfil?.nombre_empresa
    ? perfil.nombre_empresa.replace(/[<>:"/\\|?*]/g, "_").trim()
    : clienteId;

  const { data: fileData } = await supabase.storage
    .from("documentos")
    .download(storagePath);

  if (!fileData) return;

  const buffer = new Uint8Array(await fileData.arrayBuffer());

  for (const integ of integraciones) {
    if (!integ.access_token) continue;
    try {
      const { token, carpeta } = await getValidToken(integ.id);
      const destino = carpeta ? `${carpeta}/${carpetaCliente}` : carpetaCliente;
      await uploadToMicrosoft(token, destino, fileName, buffer);

      await supabase.from("integraciones_almacenamiento").update({
        ultima_sync: new Date().toISOString(),
      }).eq("id", integ.id);
    } catch {
      // Don't fail the main upload if Microsoft sync fails
    }
  }
}
