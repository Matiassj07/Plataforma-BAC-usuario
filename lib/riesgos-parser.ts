function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(
      new RegExp(
        "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
        "g"
      ),
      ""
    )
    .toLowerCase()
    .trim();
}

function normalizarSiNo(valor: string): boolean | null {
  const v = normalizarTexto(valor);
  if (v.startsWith("s")) return true;
  if (v.startsWith("n")) return false;
  return null;
}

function extraerNumero1a5(valor: string): number | null {
  const m = valor.match(/[1-5]/);
  return m ? parseInt(m[0]) : null;
}

function parsearCSVGenerico(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;
  let i = 0;

  while (i < texto.length) {
    const ch = texto[i];
    if (enComillas) {
      if (ch === '"') {
        if (i + 1 < texto.length && texto[i + 1] === '"') {
          campo += '"';
          i += 2;
        } else {
          enComillas = false;
          i++;
        }
      } else {
        campo += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        enComillas = true;
        i++;
      } else if (ch === ",") {
        fila.push(campo.trim());
        campo = "";
        i++;
      } else if (ch === "\r" || ch === "\n") {
        fila.push(campo.trim());
        campo = "";
        if (ch === "\r" && i + 1 < texto.length && texto[i + 1] === "\n") i++;
        i++;
        if (fila.some((c) => c !== "")) filas.push(fila);
        fila = [];
      } else {
        campo += ch;
        i++;
      }
    }
  }
  fila.push(campo.trim());
  if (fila.some((c) => c !== "")) filas.push(fila);
  return filas;
}

export interface RiesgoExtraido {
  actividad_nombre: string;
  codigo: string;
  area_departamento: string;
  amenazas: string;
  vulnerabilidades: string;
  probabilidad: number | null;
  impacto: number | null;
  cat_especiales_gran_escala: boolean | null;
  obs_sistematica_publica: boolean | null;
  trat_automatizado: boolean | null;
  activos_relacionados: string;
  base_legal: string;
  articulo_ley: string;
  medidas_implementadas: string;
  nivel_riesgo: string;
  requiere_eipd: boolean | null;
  medidas_implementar: string;
  prob_residual: number | null;
  imp_residual: number | null;
  nivel_riesgo_residual: string;
  semaforo: string;
  responsable_implementacion: string;
}

function riesgoVacio(): RiesgoExtraido {
  return {
    actividad_nombre: "", codigo: "", area_departamento: "",
    amenazas: "", vulnerabilidades: "", probabilidad: null, impacto: null,
    cat_especiales_gran_escala: null, obs_sistematica_publica: null,
    trat_automatizado: null, activos_relacionados: "", base_legal: "",
    articulo_ley: "", medidas_implementadas: "", nivel_riesgo: "",
    requiere_eipd: null, medidas_implementar: "", prob_residual: null,
    imp_residual: null, nivel_riesgo_residual: "", semaforo: "",
    responsable_implementacion: "",
  };
}

function calcularNivelRiesgo(valor: number): string {
  if (valor >= 20) return "Crítico";
  if (valor >= 12) return "Alto";
  if (valor >= 6) return "Medio";
  if (valor >= 3) return "Bajo";
  return "Muy bajo";
}

function semaforoDesdeNivel(nivel: string): string {
  const n = normalizarTexto(nivel);
  if (n === "critico" || n === "alto") return "rojo";
  if (n === "medio") return "amarillo";
  if (n === "bajo" || n === "muy bajo") return "verde";
  return "";
}

function asignarCampoEtiqueta(riesgo: RiesgoExtraido, etiqueta: string, valor: string) {
  const e = normalizarTexto(etiqueta);

  if (e.includes("actividad")) {
    riesgo.actividad_nombre = valor;
  } else if (e === "codigo" || e === "cod") {
    riesgo.codigo = valor;
  } else if (e.includes("area") || e.includes("departamento")) {
    riesgo.area_departamento = valor;
  } else if (e.includes("amenaza")) {
    riesgo.amenazas = valor;
  } else if (e.includes("vulnerabilidad")) {
    riesgo.vulnerabilidades = valor;
  } else if (e.includes("categorias especiales") || e.includes("cat especiales") || e.includes("gran escala")) {
    riesgo.cat_especiales_gran_escala = normalizarSiNo(valor);
  } else if (e.includes("observacion sistematica") || e.includes("obs sistematica")) {
    riesgo.obs_sistematica_publica = normalizarSiNo(valor);
  } else if (e.includes("tratamiento automatizado") || e.includes("trat automatizado")) {
    riesgo.trat_automatizado = normalizarSiNo(valor);
  } else if (e.includes("activos")) {
    riesgo.activos_relacionados = valor;
  } else if (e.includes("base legal") || e.includes("base de licitud")) {
    riesgo.base_legal = valor;
  } else if (e.includes("articulo") || e.includes("ley especifica")) {
    riesgo.articulo_ley = valor;
  } else if (e.includes("medidas ya implementadas") || (e.includes("medidas implementadas") && !e.includes("implementar"))) {
    riesgo.medidas_implementadas = valor;
  } else if (e.includes("probabilidad residual") || e === "prob residual" || e === "prob. residual") {
    riesgo.prob_residual = extraerNumero1a5(valor);
  } else if (e.includes("impacto residual") || e === "imp residual" || e === "imp. residual") {
    riesgo.imp_residual = extraerNumero1a5(valor);
  } else if (e.includes("probabilidad") || e === "prob" || e === "prob.") {
    riesgo.probabilidad = extraerNumero1a5(valor);
  } else if (e.includes("impacto") || e === "imp" || e === "imp.") {
    riesgo.impacto = extraerNumero1a5(valor);
  } else if (e.includes("medidas a implementar") || e.includes("medidas nuevas") || e.includes("controles nuevos")) {
    riesgo.medidas_implementar = valor;
  } else if (e.includes("nivel de riesgo residual") || e.includes("nivel residual") || e === "nivel riesgo residual") {
    riesgo.nivel_riesgo_residual = valor;
  } else if (e.includes("nivel de riesgo") || e.includes("nivel riesgo")) {
    riesgo.nivel_riesgo = valor;
  } else if (e.includes("requiere eipd") || e === "eipd") {
    riesgo.requiere_eipd = normalizarSiNo(valor);
  } else if (e.includes("semaforo")) {
    const sv = normalizarTexto(valor);
    if (sv === "rojo" || sv === "amarillo" || sv === "verde") riesgo.semaforo = sv;
  } else if (e.includes("responsable")) {
    riesgo.responsable_implementacion = valor;
  }
}

function parsearTextoEtiquetaValor(texto: string): RiesgoExtraido[] {
  const lineas = texto.split(/\r?\n/);
  const riesgos: RiesgoExtraido[] = [];
  let actual: RiesgoExtraido | null = null;

  for (const linea of lineas) {
    const trimmed = linea.trim();
    if (!trimmed) continue;

    if (/^riesgo\s*\d+/i.test(trimmed) || /^---+$/.test(trimmed) || /^#{1,3}\s/.test(trimmed)) {
      if (actual && (actual.actividad_nombre || actual.amenazas || actual.codigo)) {
        riesgos.push(actual);
      }
      actual = riesgoVacio();
      continue;
    }

    const match = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (match && match[2].trim()) {
      if (!actual) actual = riesgoVacio();
      asignarCampoEtiqueta(actual, match[1], match[2].trim());
    }
  }

  if (actual && (actual.actividad_nombre || actual.amenazas || actual.codigo)) {
    riesgos.push(actual);
  }

  for (const r of riesgos) {
    if (r.probabilidad && r.impacto && !r.nivel_riesgo) {
      r.nivel_riesgo = calcularNivelRiesgo(r.probabilidad * r.impacto);
    }
    if (r.prob_residual && r.imp_residual && !r.nivel_riesgo_residual) {
      r.nivel_riesgo_residual = calcularNivelRiesgo(r.prob_residual * r.imp_residual);
    }
    if (r.nivel_riesgo && !r.semaforo) {
      r.semaforo = semaforoDesdeNivel(r.nivel_riesgo);
    }
  }

  return riesgos;
}

interface MapaColumnasRiesgo {
  codigo: number;
  area_departamento: number;
  actividad_nombre: number;
  cat_especiales_gran_escala: number;
  obs_sistematica_publica: number;
  trat_automatizado: number;
  activos_relacionados: number;
  base_legal: number;
  articulo_ley: number;
  amenazas: number;
  vulnerabilidades: number;
  medidas_implementadas: number;
  probabilidad: number;
  impacto: number;
  riesgo_inherente: number;
  nivel_riesgo: number;
  requiere_eipd: number;
  medidas_implementar: number;
  prob_residual: number;
  imp_residual: number;
  riesgo_residual: number;
  nivel_riesgo_residual: number;
  responsable_implementacion: number;
  semaforo: number;
}

function mapaDefaultRiesgo(): MapaColumnasRiesgo {
  return {
    codigo: 0, area_departamento: 1, actividad_nombre: 2,
    cat_especiales_gran_escala: 3, obs_sistematica_publica: 4, trat_automatizado: 5,
    activos_relacionados: 6, base_legal: 7, articulo_ley: 8,
    amenazas: 9, vulnerabilidades: 10, medidas_implementadas: 11,
    probabilidad: 12, impacto: 13, riesgo_inherente: 14, nivel_riesgo: 15,
    requiere_eipd: 16, medidas_implementar: 17,
    prob_residual: 18, imp_residual: 19, riesgo_residual: 20, nivel_riesgo_residual: 21,
    responsable_implementacion: 22, semaforo: -1,
  };
}

function mapearColumnasRiesgo(encabezado: string[]): MapaColumnasRiesgo {
  const mapa = mapaDefaultRiesgo();
  for (let i = 0; i < encabezado.length; i++) {
    const h = normalizarTexto(encabezado[i]);
    if (!h) continue;
    if (h.includes("codigo") || h === "cod") mapa.codigo = i;
    else if (h.includes("area") || h.includes("departamento")) mapa.area_departamento = i;
    else if (h.includes("actividad")) mapa.actividad_nombre = i;
    else if (h.includes("categorias especiales") || h.includes("cat especiales") || h.includes("gran escala")) mapa.cat_especiales_gran_escala = i;
    else if (h.includes("observacion sistematica") || h.includes("obs sistematica")) mapa.obs_sistematica_publica = i;
    else if (h.includes("tratamiento automatizado") || h.includes("trat automatizado") || h.includes("decisiones automatizadas")) mapa.trat_automatizado = i;
    else if (h.includes("activo") && !h.includes("actividad")) mapa.activos_relacionados = i;
    else if (h.includes("base legal") || h.includes("base de licitud") || h.includes("normativa")) mapa.base_legal = i;
    else if (h.includes("articulo") || h.includes("ley especifica")) mapa.articulo_ley = i;
    else if (h.includes("amenaza")) mapa.amenazas = i;
    else if (h.includes("vulnerabilidad")) mapa.vulnerabilidades = i;
    else if ((h.includes("medidas") && (h.includes("implementadas") || h.includes("ya"))) || h.includes("controles existentes")) mapa.medidas_implementadas = i;
    else if (h.includes("probabilidad") && h.includes("residual")) mapa.prob_residual = i;
    else if (h.includes("impacto") && h.includes("residual")) mapa.imp_residual = i;
    else if (h.includes("probabilidad") || (h.includes("prob") && !h.includes("residual"))) mapa.probabilidad = i;
    else if (h.includes("impacto") && !h.includes("residual")) mapa.impacto = i;
    else if (h.includes("riesgo inherente") && !h.includes("nivel")) mapa.riesgo_inherente = i;
    else if (h.includes("riesgo residual") && !h.includes("nivel")) mapa.riesgo_residual = i;
    else if (h.includes("nivel") && h.includes("residual")) mapa.nivel_riesgo_residual = i;
    else if (h.includes("nivel") && h.includes("riesgo")) mapa.nivel_riesgo = i;
    else if (h.includes("eipd") || h.includes("requiere eipd")) mapa.requiere_eipd = i;
    else if (h.includes("medidas") && (h.includes("implementar") || h.includes("nueva") || h.includes("mitigacion") || h.includes("plan"))) mapa.medidas_implementar = i;
    else if (h.includes("responsable")) mapa.responsable_implementacion = i;
    else if (h.includes("semaforo")) mapa.semaforo = i;
  }
  return mapa;
}

function col(fila: string[], idx: number): string {
  if (idx < 0 || idx >= fila.length) return "";
  return fila[idx]?.trim() ?? "";
}

function esFilaHeaderRiesgo(fila: string[]): boolean {
  const norm = fila.map((c) => normalizarTexto(c));
  const tieneAmenaza = norm.some((c) => c.includes("amenaza"));
  const tieneProbabilidad = norm.some((c) => c.includes("probabilidad") || c.includes("prob"));
  const tieneActividad = norm.some((c) => c.includes("actividad"));
  const tieneCodigo = norm.some((c) => c.includes("codigo") || c === "cod");
  const tieneVulnerabilidad = norm.some((c) => c.includes("vulnerabilidad"));
  return (tieneAmenaza && tieneProbabilidad) || (tieneCodigo && tieneActividad) || (tieneAmenaza && tieneVulnerabilidad);
}

function parsearCSVRiesgos(texto: string): RiesgoExtraido[] {
  const filas = parsearCSVGenerico(texto);
  if (filas.length < 2) return [];

  let encIdx = -1;
  let mapa = mapaDefaultRiesgo();
  for (let i = 0; i < Math.min(filas.length, 30); i++) {
    if (esFilaHeaderRiesgo(filas[i])) {
      encIdx = i;
      mapa = mapearColumnasRiesgo(filas[i]);
      break;
    }
  }

  if (encIdx < 0) return [];

  const datosInicio = encIdx + 1;
  const boolCampos = ["cat_especiales_gran_escala", "obs_sistematica_publica", "trat_automatizado", "requiere_eipd"];
  const numCampos = ["probabilidad", "impacto", "prob_residual", "imp_residual"];
  const skipCampos = ["riesgo_inherente", "riesgo_residual"];

  const riesgos: RiesgoExtraido[] = [];

  for (let i = datosInicio; i < filas.length; i++) {
    const fila = filas[i];
    if (fila.length < 5) continue;

    const actVal = col(fila, mapa.actividad_nombre);
    const codVal = col(fila, mapa.codigo);
    const amenVal = col(fila, mapa.amenazas);
    if (!actVal && !codVal && !amenVal) continue;

    const normFirst = normalizarTexto(actVal || codVal);
    if (normFirst.includes("codigo") || normFirst.includes("actividad de tratamiento") || normFirst.includes("tratamiento de datos")) continue;

    const r = riesgoVacio();
    const campos: (keyof MapaColumnasRiesgo)[] = [
      "codigo", "area_departamento", "actividad_nombre",
      "cat_especiales_gran_escala", "obs_sistematica_publica", "trat_automatizado",
      "activos_relacionados", "base_legal", "articulo_ley",
      "amenazas", "vulnerabilidades", "medidas_implementadas",
      "probabilidad", "impacto", "riesgo_inherente", "nivel_riesgo",
      "requiere_eipd", "medidas_implementar",
      "prob_residual", "imp_residual", "riesgo_residual", "nivel_riesgo_residual",
      "responsable_implementacion", "semaforo",
    ];

    for (const campo of campos) {
      const idx = mapa[campo];
      const val = col(fila, idx);
      if (!val) continue;
      if (skipCampos.includes(campo)) continue;

      if (boolCampos.includes(campo)) {
        (r as any)[campo] = normalizarSiNo(val);
      } else if (numCampos.includes(campo)) {
        (r as any)[campo] = extraerNumero1a5(val);
      } else {
        (r as any)[campo] = val;
      }
    }

    if (r.probabilidad && r.impacto && !r.nivel_riesgo) {
      r.nivel_riesgo = calcularNivelRiesgo(r.probabilidad * r.impacto);
    }
    if (r.prob_residual && r.imp_residual && !r.nivel_riesgo_residual) {
      r.nivel_riesgo_residual = calcularNivelRiesgo(r.prob_residual * r.imp_residual);
    }
    if (r.nivel_riesgo && !r.semaforo) {
      r.semaforo = semaforoDesdeNivel(r.nivel_riesgo);
    }

    riesgos.push(r);
  }

  return riesgos;
}

function esFormatoCSV(texto: string): boolean {
  const primerasLineas = texto.split(/\r?\n/).slice(0, 15).join("\n");
  const norm = normalizarTexto(primerasLineas);
  if (norm.includes("matriz de riesgo")) return true;
  if (norm.includes("amenaza") && norm.includes("probabilidad")) return true;
  const commaLines = texto.split(/\r?\n/).filter((l) => l.trim()).slice(0, 8);
  const avgCommas = commaLines.reduce((sum, l) => sum + (l.match(/,/g)?.length ?? 0), 0) / (commaLines.length || 1);
  return avgCommas >= 8;
}

export function parsearTextoRiesgos(texto: string): RiesgoExtraido[] {
  if (esFormatoCSV(texto)) {
    const resultado = parsearCSVRiesgos(texto);
    if (resultado.length > 0) return resultado;
  }
  const etiquetaValor = parsearTextoEtiquetaValor(texto);
  if (etiquetaValor.length > 0) return etiquetaValor;
  return parsearCSVRiesgos(texto);
}

export function generarPlantillaRiesgosTxt(): string {
  return `RIESGO 1
Actividad de Tratamiento:
Codigo: RIES-01
Area/Departamento:
Amenazas:
Vulnerabilidades:
Categorias especiales a gran escala: No
Observacion sistematica publica: No
Medidas ya Implementadas:
Probabilidad: 3
Impacto: 4
Medidas a Implementar:
Probabilidad Residual: 2
Impacto Residual: 2
Semaforo: Amarillo
Responsable de Implementacion:

RIESGO 2
Actividad de Tratamiento:
Codigo: RIES-02
Area/Departamento:
Amenazas:
Vulnerabilidades:
Categorias especiales a gran escala: No
Observacion sistematica publica: No
Medidas ya Implementadas:
Probabilidad:
Impacto:
Medidas a Implementar:
Probabilidad Residual:
Impacto Residual:
Semaforo:
Responsable de Implementacion:
`;
}
