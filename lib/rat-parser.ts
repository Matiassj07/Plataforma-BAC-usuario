export interface RatResponsableExtraido {
  responsable: string;
  ruc: string;
  direccion: string;
  telefono: string;
  web: string;
  encargado: string;
}

export interface RatDpdExtraido {
  nombre: string;
  direccion: string;
  correo: string;
}

export interface ActividadRatExtraida {
  nombre_actividad: string;
  finalidad: string;
  categoria_datos: string;
  categorias_especiales: string;
  categorias_titulares: string;
  perfiles_automatizados: "" | "si" | "no";
  base_licitud: string;
  plazo_conservacion: string;
  destinatarios: string;
  transferencias_internacionales: "" | "si" | "no";
  medidas_seguridad: string;
  departamento: string;
  origen_datos: string;
  articulo_lopdp: string;
  almacenamiento: string;
  activo_informacion: string;
}

export interface RatExtraido {
  responsable: RatResponsableExtraido;
  dpd: RatDpdExtraido;
  actividades: ActividadRatExtraida[];
  lineasNoReconocidas: string[];
}

const DIACRITICS_RE = new RegExp(
  "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
  "g"
);

function normalizarTexto(t: string): string {
  return t.normalize("NFD").replace(DIACRITICS_RE, "").toLowerCase().trim();
}

function normalizarSiNo(v: string): "" | "si" | "no" {
  const n = normalizarTexto(v);
  if (!n || n === "-") return "";
  if (n.startsWith("s")) return "si";
  if (n.startsWith("n")) return "no";
  return "";
}

function actividadVacia(): ActividadRatExtraida {
  return {
    nombre_actividad: "", finalidad: "", categoria_datos: "", categorias_especiales: "",
    categorias_titulares: "", perfiles_automatizados: "", base_licitud: "",
    plazo_conservacion: "", destinatarios: "", transferencias_internacionales: "",
    medidas_seguridad: "", departamento: "", origen_datos: "", articulo_lopdp: "",
    almacenamiento: "", activo_informacion: "",
  };
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

function esFormatoCSV(texto: string): boolean {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim()).slice(0, 15);
  if (lineas.length === 0) return false;

  const commasPerLine = lineas.map((l) => (l.match(/,/g)?.length ?? 0));
  const avgCommas = commasPerLine.reduce((s, c) => s + c, 0) / lineas.length;
  if (avgCommas >= 5) return true;

  for (const linea of lineas) {
    const normL = normalizarTexto(linea);
    const commas = (linea.match(/,/g)?.length ?? 0);
    if (commas >= 5 && normL.includes("departamento") && normL.includes("finalidad")) return true;
  }

  return false;
}

function extraerEtiquetaValor(texto: string): { etiqueta: string; valor: string } | null {
  const idx = texto.indexOf(":");
  if (idx < 0) return null;
  const etiqueta = normalizarTexto(texto.slice(0, idx));
  const valor = texto.slice(idx + 1).trim();
  if (!valor) return null;
  return { etiqueta, valor };
}

function extraerResponsableDpdCSV(filas: string[][]): { responsable: RatResponsableExtraido; dpd: RatDpdExtraido } {
  const responsable: RatResponsableExtraido = { responsable: "", ruc: "", direccion: "", telefono: "", web: "", encargado: "" };
  const dpd: RatDpdExtraido = { nombre: "", direccion: "", correo: "" };

  for (let i = 0; i < Math.min(filas.length, 12); i++) {
    const fila = filas[i];
    const norm = normalizarTexto(fila.join(" "));
    if (norm.includes("departamento") && norm.includes("actividades de tratamiento")) break;

    for (const celda of fila) {
      if (!celda || !celda.includes(":")) continue;
      const par = extraerEtiquetaValor(celda);
      if (!par) continue;
      const { etiqueta, valor } = par;

      if (etiqueta.includes("nombre") || etiqueta.includes("razon social")) {
        if (!responsable.responsable && !etiqueta.includes("dpd")) responsable.responsable = valor;
        else if (!dpd.nombre) dpd.nombre = valor;
      } else if (etiqueta.includes("ruc") || etiqueta.includes("c.i") || etiqueta === "ci" || etiqueta.includes("cedula")) {
        responsable.ruc = valor;
      } else if (etiqueta.includes("correo") || etiqueta.includes("email")) {
        dpd.correo = valor;
      } else if (etiqueta.includes("telefono")) {
        responsable.telefono = valor;
      } else if (etiqueta.includes("web") || etiqueta.includes("sitio")) {
        responsable.web = valor;
      } else if (etiqueta.includes("encargado")) {
        responsable.encargado = valor;
      } else if (etiqueta.includes("direccion")) {
        if (!responsable.direccion) responsable.direccion = valor;
        else if (!dpd.direccion) dpd.direccion = valor;
      }
    }
  }
  return { responsable, dpd };
}

interface MapaColumnas {
  departamento: number; actividad: number; finalidad: number;
  categoriaDatos: number; categoriasEspeciales: number; perfilesAutomatizados: number;
  categoriasTitulares: number; origenDatos: number; baseLicitud: number;
  articulo: number; almacenamiento: number; plazoConservacion: number;
  destinatarios: number; transferenciasInternacionales: number;
  medidasSeguridad: number; activoInformacion: number;
}

function mapaDefault(): MapaColumnas {
  return {
    departamento: 0, actividad: 1, finalidad: 4, categoriaDatos: 5,
    categoriasEspeciales: 6, perfilesAutomatizados: 7, categoriasTitulares: 8,
    origenDatos: 9, baseLicitud: 10, articulo: 11, almacenamiento: 12,
    plazoConservacion: 13, destinatarios: 14, transferenciasInternacionales: 15,
    medidasSeguridad: 16, activoInformacion: 17,
  };
}

function mapearColumnas(encabezado: string[]): MapaColumnas {
  const mapa = mapaDefault();
  for (let i = 0; i < encabezado.length; i++) {
    const h = normalizarTexto(encabezado[i]);
    if (!h) continue;
    if (h.includes("departamento")) mapa.departamento = i;
    else if (h.includes("actividades de tratamiento") || h === "actividad") mapa.actividad = i;
    else if (h.includes("finalidad")) mapa.finalidad = i;
    else if ((h.includes("categoria de datos") || h.includes("categorias de datos")) && !h.includes("especial")) mapa.categoriaDatos = i;
    else if (h.includes("categorias especiales") || h.includes("especiales de datos")) mapa.categoriasEspeciales = i;
    else if (h.includes("perfiles") || h.includes("automatizado")) mapa.perfilesAutomatizados = i;
    else if (h.includes("categorias de titulares") || h.includes("titulares")) mapa.categoriasTitulares = i;
    else if (h.includes("origen")) mapa.origenDatos = i;
    else if (h.includes("base de licitud") || h.includes("base legal")) mapa.baseLicitud = i;
    else if (h.includes("articulo")) mapa.articulo = i;
    else if (h.includes("almacenamiento")) mapa.almacenamiento = i;
    else if (h.includes("plazo") && h.includes("conservacion")) mapa.plazoConservacion = i;
    else if (h.includes("destinatarios")) mapa.destinatarios = i;
    else if (h.includes("transferencias")) mapa.transferenciasInternacionales = i;
    else if (h.includes("medidas") && (h.includes("seguridad") || h.includes("tecnicas"))) mapa.medidasSeguridad = i;
    else if (h.includes("activo de informacion") || (h.includes("activo") && !h.includes("actividad"))) mapa.activoInformacion = i;
  }
  return mapa;
}

function col(fila: string[], idx: number): string {
  if (idx < 0 || idx >= fila.length) return "";
  return fila[idx]?.trim() ?? "";
}

function parsearCSVRat(texto: string): RatExtraido {
  const filas = parsearCSVGenerico(texto);
  const { responsable, dpd } = extraerResponsableDpdCSV(filas);

  let encIdx = -1;
  let mapa = mapaDefault();
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const norm = filas[i].map((c) => normalizarTexto(c));
    if (norm.some((c) => c.includes("departamento")) && norm.some((c) => c.includes("finalidad"))) {
      encIdx = i;
      mapa = mapearColumnas(filas[i]);
      break;
    }
  }

  const datosInicio = encIdx >= 0 ? encIdx + 1 : 0;
  const actividades: ActividadRatExtraida[] = [];

  for (let i = datosInicio; i < filas.length; i++) {
    const fila = filas[i];
    if (fila.length < 8) continue;
    const deptOrAct = col(fila, mapa.departamento) || col(fila, mapa.actividad);
    if (!deptOrAct) continue;
    const normFirst = normalizarTexto(deptOrAct);
    if (normFirst.includes("departamento") || normFirst.includes("registro de actividades")) continue;

    actividades.push({
      nombre_actividad: col(fila, mapa.actividad) || deptOrAct,
      departamento: col(fila, mapa.departamento),
      finalidad: col(fila, mapa.finalidad),
      categoria_datos: col(fila, mapa.categoriaDatos),
      categorias_especiales: col(fila, mapa.categoriasEspeciales),
      perfiles_automatizados: normalizarSiNo(col(fila, mapa.perfilesAutomatizados)),
      categorias_titulares: col(fila, mapa.categoriasTitulares),
      origen_datos: col(fila, mapa.origenDatos),
      base_licitud: col(fila, mapa.baseLicitud),
      articulo_lopdp: col(fila, mapa.articulo),
      almacenamiento: col(fila, mapa.almacenamiento),
      plazo_conservacion: col(fila, mapa.plazoConservacion),
      destinatarios: col(fila, mapa.destinatarios),
      transferencias_internacionales: normTransfIntl(col(fila, mapa.transferenciasInternacionales)),
      medidas_seguridad: col(fila, mapa.medidasSeguridad),
      activo_informacion: col(fila, mapa.activoInformacion),
    });
  }

  return { responsable, dpd, actividades, lineasNoReconocidas: [] };
}

type Seccion = "responsable" | "dpd" | "actividad";

function esInicioActividad(normLinea: string): boolean {
  return /^(actividad|registro)\s*(#|n)?\s*\d+/i.test(normLinea)
    || normLinea === "actividad";
}

function normTransfIntl(valor: string): "" | "si" | "no" {
  const v = normalizarTexto(valor);
  if (!v || v === "-") return "";
  if (v.startsWith("no")) return "no";
  if (v.startsWith("si") || v.startsWith("posiblemente")) return "si";
  return "";
}

function asignarCampoActividad(
  act: ActividadRatExtraida,
  etiqueta: string,
  valor: string,
): boolean {
  if (
    etiqueta.includes("nombre de la actividad")
    || etiqueta === "actividad"
    || etiqueta.includes("actividad de tratamiento")
    || etiqueta.includes("actividades de tratamiento")
  ) {
    act.nombre_actividad = valor;
  } else if (
    etiqueta.includes("categorias especiales")
    || etiqueta.includes("categoria especial")
    || etiqueta.includes("categorias especiales de datos")
  ) {
    act.categorias_especiales = valor;
  } else if (
    etiqueta.includes("categorias de titulares")
    || etiqueta.includes("categorias titulares")
    || etiqueta.includes("categoria de titulares")
  ) {
    act.categorias_titulares = valor;
  } else if (
    (etiqueta.includes("categoria de datos") || etiqueta.includes("categorias de datos") || etiqueta.includes("categoria datos"))
    && !etiqueta.includes("especial")
  ) {
    act.categoria_datos = valor;
  } else if (
    etiqueta.includes("perfiles automatizados")
    || etiqueta.includes("perfilamiento")
    || etiqueta.includes("elaboracion de perfiles")
  ) {
    act.perfiles_automatizados = normalizarSiNo(valor);
  } else if (etiqueta.includes("base de licitud") || etiqueta.includes("base legal")) {
    act.base_licitud = valor;
  } else if (etiqueta.includes("articulo")) {
    act.articulo_lopdp = valor;
  } else if (etiqueta.includes("plazo de conservacion") || etiqueta.includes("plazo")) {
    act.plazo_conservacion = valor;
  } else if (etiqueta.includes("destinatarios")) {
    act.destinatarios = valor;
  } else if (
    etiqueta.includes("transferencias internacionales")
    || etiqueta.includes("transferencia internacional")
  ) {
    act.transferencias_internacionales = normTransfIntl(valor);
  } else if (
    etiqueta.includes("medidas de seguridad")
    || etiqueta.includes("medidas tecnicas")
    || etiqueta.includes("medidas tecnicas y organizativas")
  ) {
    act.medidas_seguridad = valor;
  } else if (etiqueta.includes("origen de los datos") || etiqueta === "origen") {
    act.origen_datos = valor;
  } else if (etiqueta.includes("almacenamiento")) {
    act.almacenamiento = valor;
  } else if (etiqueta.includes("activo de informacion") || (etiqueta.includes("activo") && !etiqueta.includes("actividad"))) {
    act.activo_informacion = valor;
  } else if (etiqueta.includes("finalidad")) {
    act.finalidad = valor;
  } else if (etiqueta.includes("departamento")) {
    act.departamento = valor;
  } else if (
    etiqueta.includes("descripcion")
    || etiqueta.includes("detalle de la actividad")
    || etiqueta.includes("descripcion / detalle")
  ) {
    if (act.finalidad) {
      act.finalidad = `${act.finalidad}. ${valor}`;
    } else {
      act.finalidad = valor;
    }
  } else if (
    etiqueta.includes("categoria / proceso")
    || etiqueta.includes("proceso de tratamiento")
  ) {
    if (!act.nombre_actividad) act.nombre_actividad = valor;
  } else {
    return false;
  }
  return true;
}

function parsearTextoEtiquetaValor(texto: string): RatExtraido {
  const responsable: RatResponsableExtraido = { responsable: "", ruc: "", direccion: "", telefono: "", web: "", encargado: "" };
  const dpd: RatDpdExtraido = { nombre: "", direccion: "", correo: "" };
  const actividades: ActividadRatExtraida[] = [];
  const lineasNoReconocidas: string[] = [];

  let seccion: Seccion = "responsable";
  let actividadActual: ActividadRatExtraida | null = null;

  const lineas = texto.split(/\r?\n/);

  for (let li = 0; li < lineas.length; li++) {
    const lineaOriginal = lineas[li];
    const linea = lineaOriginal.trim();
    if (!linea || /^[=]{3,}$/.test(linea)) continue;
    const normLinea = normalizarTexto(linea);

    if (normLinea.includes("responsable de tratamiento")) { seccion = "responsable"; continue; }
    if (
      normLinea.includes("delegado de proteccion")
      || normLinea.includes("proteccion de datos")
      || normLinea.includes("delegado de proteccion de datos")
    ) { seccion = "dpd"; continue; }
    if (
      normLinea.includes("actividades de tratamiento")
      && !normLinea.includes(":")
      && !normLinea.includes("registro")
    ) { continue; }

    if (esInicioActividad(normLinea)) {
      seccion = "actividad";
      if (actividadActual && actividadActual.nombre_actividad) actividades.push(actividadActual);
      actividadActual = actividadVacia();
      continue;
    }

    if (/^[-]{3,}$/.test(linea)) {
      if (seccion === "actividad") {
        if (actividadActual && actividadActual.nombre_actividad) actividades.push(actividadActual);
        actividadActual = actividadVacia();
      }
      continue;
    }

    if (!linea.includes(":")) continue;

    const idx = linea.indexOf(":");
    const etiqueta = normalizarTexto(linea.slice(0, idx));
    const valor = linea.slice(idx + 1).trim();
    if (!valor) continue;

    if (seccion === "responsable") {
      const e = etiqueta;
      if (
        e.includes("nombre de la empresa") || e.includes("razon social") || e === "empresa" || e === "nombre"
      ) responsable.responsable = valor;
      else if (e.includes("ruc") || e.includes("c.i") || e === "ci" || e.includes("cedula")) responsable.ruc = valor;
      else if (e.includes("telefono")) responsable.telefono = valor;
      else if (e.includes("web") || e.includes("sitio")) responsable.web = valor;
      else if (e.includes("encargado")) responsable.encargado = valor;
      else if (e.includes("direccion")) responsable.direccion = valor;
      else if (e.includes("correo") || e.includes("email")) dpd.correo = valor;
      else lineasNoReconocidas.push(lineaOriginal.trim());
      continue;
    }

    if (seccion === "dpd") {
      if (etiqueta.includes("correo") || etiqueta.includes("email") || etiqueta.includes("e-mail")) dpd.correo = valor;
      else if (etiqueta.includes("direccion")) dpd.direccion = valor;
      else if (etiqueta.includes("nombre")) dpd.nombre = valor;
      else lineasNoReconocidas.push(lineaOriginal.trim());
      continue;
    }

    if (!actividadActual) actividadActual = actividadVacia();
    if (!asignarCampoActividad(actividadActual, etiqueta, valor)) {
      lineasNoReconocidas.push(lineaOriginal.trim());
    }
  }

  if (actividadActual && actividadActual.nombre_actividad) actividades.push(actividadActual);
  return { responsable, dpd, actividades, lineasNoReconocidas };
}

export function parsearTextoRat(texto: string): RatExtraido {
  if (esFormatoCSV(texto)) return parsearCSVRat(texto);
  return parsearTextoEtiquetaValor(texto);
}

export function generarPlantillaRatTxt(): string {
  return `RESPONSABLE DE TRATAMIENTO
Nombre de la empresa: Mi Empresa S.A.
RUC: 1234567890001
Dirección: Av. Principal, Quito
Teléfono: 022345678
Sitio web: www.miempresa.ec
Encargado de Tratamiento: Proveedor Hosting

DELEGADO DE PROTECCIÓN DE DATOS
Nombre del DPD: Juan Pérez
Dirección del DPD: Av. 6 de Diciembre, Quito
Correo del DPD: dpd@miempresa.ec

ACTIVIDAD 1
Nombre de la actividad: Gestión de Nómina
Departamento: Recursos Humanos
Finalidad: Pago de sueldos y beneficios
Categoría de Datos: identificativos, financieros
Categorías de Titulares: empleados
Categorías Especiales: Ninguna
Perfiles automatizados: No
Base de Licitud: Ejecución de un contrato
Artículo LOPDP: Art. 7
Plazo de Conservación: 7 años
Destinatarios: SRI, IESS
Transferencias Internacionales: No
Medidas de Seguridad: Cifrado de base de datos
Origen de los Datos: Formulario de contratación
Almacenamiento: Servidor local
Activo de Información: Sistema de nómina
`;
}
