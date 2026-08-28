export type RolEnum = "cliente" | "admin" | "revendedor" | "contador" | "asistente";
export type PersonalRolEnum = "contador" | "asistente" | "cliente";
export type TipoUsuarioEnum = "interno_bac" | "cliente_externo" | "revendedor";
export type TamanoEmpresaEnum = "1_10" | "11_50" | "51_200" | "201_500" | "500_plus";
export type TieneDpdEnum = "si_interno" | "si_externo" | "no" | "no_sabe";
export type IdiomaEnum = "es" | "en";
export type NichoEnum =
  | "grupos"
  | "broker"
  | "escuelas_conduccion"
  | "telecomunicaciones"
  | "escuelas"
  | "laboratorios"
  | "clinicas"
  | "industriales"
  | "restaurantes"
  | "firma_legal"
  | "hoteles"
  | "cooperativa"
  | "otros";
export type EtapaFlujoEnum =
  | "sin_iniciar"
  | "onboarding"
  | "rat_completado"
  | "riesgos_completados"
  | "docs_completos"
  | "plan_implementacion"
  | "dpd_completado"
  | "auditado";
export type DpdTipoEnum = "interno" | "externo";
export type SeveridadEnum = "critica" | "media" | "baja";
export type SemaforoEnum = "rojo" | "amarillo" | "verde";
export type NivelAccesoEnum = "solo_lectura" | "lectura_carga";

export const NIVEL_ACCESO_LABELS: Record<NivelAccesoEnum, string> = {
  solo_lectura: "Solo lectura",
  lectura_carga: "Lectura y carga de documentos",
};

export const PERSONAL_ROL_LABELS: Record<PersonalRolEnum, string> = {
  contador: "Contador",
  asistente: "Asistente",
  cliente: "Cliente",
};

export interface PersonalUser {
  id: string;
  auth_user_id: string;
  profile_id: string;
  nombre: string;
  email: string;
  rol: PersonalRolEnum;
  cargo: string | null;
  area: string | null;
}

export interface CurrentUser {
  type: "profile" | "personal";
  profile: Profile;
  personalUser?: PersonalUser;
  effectiveRol: PersonalRolEnum | "admin";
}

export interface Profile {
  id: string;
  email: string;
  nombre_empresa: string;
  nicho: NichoEnum;
  rol: RolEnum;
  created_at: string;
  sector: string | null;
  tamano_empresa: TamanoEmpresaEnum | null;
  trata_datos_especiales: string[] | null;
  tiene_dpd: TieneDpdEnum | null;
  tipo_usuario: TipoUsuarioEnum;
  es_pro: boolean;
  pro_aprobado_por_admin: boolean;
  pro_activado_en: string | null;
  onboarding_completado: boolean;
  onboarding_paso: number;
  idioma: IdiomaEnum;
  ruc: string | null;
  direccion: string | null;
  telefono: string | null;
  web: string | null;
  notificaciones: Record<string, boolean> | null;
  suspendido: boolean;
  ultima_actividad: string | null;
  nivel_acceso: NivelAccesoEnum | null;
  dpd_tipo: DpdTipoEnum | null;
  dpd_activo: boolean;
}

export const SECTOR_LABELS: Record<NichoEnum, string> = {
  grupos: "Grupos empresariales",
  broker: "Seguros / Broker",
  escuelas_conduccion: "Escuelas de conducción",
  telecomunicaciones: "Telecomunicaciones",
  escuelas: "Educación",
  laboratorios: "Laboratorios",
  clinicas: "Salud",
  industriales: "Industrial",
  restaurantes: "Restaurantes",
  firma_legal: "Firma legal",
  hoteles: "Hoteles",
  cooperativa: "Cooperativa de ahorro y crédito",
  otros: "Otros",
};

export const TAMANO_LABELS: Record<TamanoEmpresaEnum, string> = {
  "1_10": "1-10 empleados",
  "11_50": "11-50 empleados",
  "51_200": "51-200 empleados",
  "201_500": "201-500 empleados",
  "500_plus": "500+ empleados",
};

export const TIENE_DPD_LABELS: Record<TieneDpdEnum, string> = {
  si_interno: "Sí, interno",
  si_externo: "Sí, externo",
  no: "No",
  no_sabe: "No sabe",
};

export const DPD_TIPO_LABELS: Record<DpdTipoEnum, string> = {
  interno: "Interno (DPD activo)",
  externo: "Externo (DPD no activo)",
};

export const ETAPA_FLUJO_LABELS: Record<EtapaFlujoEnum, string> = {
  sin_iniciar: "Sin iniciar",
  onboarding: "Onboarding",
  rat_completado: "RAT completado",
  riesgos_completados: "Riesgos completados",
  docs_completos: "Docs completos",
  plan_implementacion: "Plan de implementación",
  dpd_completado: "DPD",
  auditado: "Auditado",
};

export interface ActividadRat {
  id: string;
  rat_version_id: string;
  activo_informacion: string | null;
  nombre_actividad: string | null;
  finalidad: string | null;
  categoria_datos: string[] | null;
  categorias_especiales: string | null;
  perfiles_automatizados: boolean | null;
  categorias_titulares: string[] | null;
  origen_datos: string | null;
  base_licitud: string | null;
  articulo_lopdp: string | null;
  plazo_conservacion: string | null;
  destinatarios: string | null;
  transferencias_internacionales: boolean | null;
  medidas_seguridad: string | null;
  almacenamiento: string | null;
  departamento: string | null;
}

export interface DocActividadRat {
  id: string;
  actividad_rat_id: string;
  nombre_archivo: string;
  url_storage: string;
  fecha_subida: string;
}

export interface RatVersion {
  id: string;
  profile_id: string;
  version: number;
  created_at: string;
  datos_responsable: Record<string, string> | null;
  datos_dpd: Record<string, string> | null;
  actividades_rat: ActividadRat[];
  docsActividades?: DocActividadRat[];
}

export const COLUMNAS_RAT: { key: keyof ActividadRat; label: string }[] = [
  { key: "departamento", label: "Departamento" },
  { key: "nombre_actividad", label: "Actividad de Tratamiento" },
  { key: "finalidad", label: "Finalidad" },
  { key: "categoria_datos", label: "Categoría de Datos" },
  { key: "categorias_especiales", label: "Categorías Especiales de Datos" },
  { key: "perfiles_automatizados", label: "Elaboración de Perfiles Automatizados" },
  { key: "categorias_titulares", label: "Categorías de Titulares" },
  { key: "origen_datos", label: "Origen de los Datos" },
  { key: "base_licitud", label: "Base de Licitud" },
  { key: "articulo_lopdp", label: "Artículo LOPDP" },
  { key: "almacenamiento", label: "Almacenamiento" },
  { key: "plazo_conservacion", label: "Plazo de Conservación" },
  { key: "destinatarios", label: "Destinatarios" },
  { key: "transferencias_internacionales", label: "Transferencias Internacionales de Datos" },
  { key: "medidas_seguridad", label: "Medidas Técnicas y Organizativas de Seguridad" },
  { key: "activo_informacion", label: "Activo de Información" },
];

export interface ActividadRiesgo {
  id: string;
  matriz_id: string;
  codigo: string | null;
  area_departamento: string | null;
  actividad_tratamiento: string | null;
  cat_especiales_gran_escala: boolean | null;
  obs_sistematica_publica: boolean | null;
  trat_automatizado: boolean | null;
  activos_relacionados: string | null;
  base_legal: string | null;
  articulo_ley: string | null;
  amenazas: string | null;
  vulnerabilidades: string | null;
  medidas_implementadas: string | null;
  probabilidad: number | null;
  impacto: number | null;
  riesgo_inherente: number | null;
  nivel_riesgo: string | null;
  requiere_eipd: boolean | null;
  medidas_implementar: string | null;
  prob_residual: number | null;
  imp_residual: number | null;
  riesgo_residual: number | null;
  nivel_riesgo_residual: string | null;
  responsable_implementacion: string | null;
}

export interface MatrizVersion {
  id: string;
  profile_id: string;
  version: number;
  created_at: string;
  actividades_riesgo: ActividadRiesgo[];
}

export interface GrupoColumnaRiesgo {
  grupo: string;
  columnas: { key: keyof ActividadRiesgo; label: string }[];
}

export const GRUPOS_RIESGO: GrupoColumnaRiesgo[] = [
  {
    grupo: "Tratamiento de Datos Personales",
    columnas: [
      { key: "codigo", label: "Código" },
      { key: "area_departamento", label: "Área / Departamento" },
      { key: "actividad_tratamiento", label: "Actividad de Tratamiento" },
      { key: "cat_especiales_gran_escala", label: "Cat. especiales gran escala?" },
      { key: "obs_sistematica_publica", label: "Obs. sistemática pública?" },
      { key: "trat_automatizado", label: "Tratamiento automatizado?" },
      { key: "activos_relacionados", label: "Activos Relacionados" },
      { key: "base_legal", label: "Base Legal" },
      { key: "articulo_ley", label: "Artículo / Ley" },
      { key: "amenazas", label: "Amenazas" },
      { key: "vulnerabilidades", label: "Vulnerabilidades" },
      { key: "medidas_implementadas", label: "Medidas Implementadas" },
    ],
  },
  {
    grupo: "Análisis de Riesgo Inherente",
    columnas: [
      { key: "probabilidad", label: "Prob. (1-5)" },
      { key: "impacto", label: "Impacto (1-5)" },
      { key: "riesgo_inherente", label: "Riesgo Inherente" },
      { key: "nivel_riesgo", label: "Nivel de Riesgo" },
    ],
  },
  {
    grupo: "EIPD",
    columnas: [
      { key: "requiere_eipd", label: "Requiere EIPD?" },
    ],
  },
  {
    grupo: "Plan de Mitigación / Riesgo Residual",
    columnas: [
      { key: "medidas_implementar", label: "Medidas a Implementar" },
      { key: "prob_residual", label: "Prob. Residual (1-5)" },
      { key: "imp_residual", label: "Imp. Residual (1-5)" },
      { key: "riesgo_residual", label: "Riesgo Residual" },
      { key: "nivel_riesgo_residual", label: "Nivel Riesgo Residual" },
      { key: "responsable_implementacion", label: "Responsable" },
    ],
  },
];

export const COLUMNAS_RIESGO = GRUPOS_RIESGO.flatMap((g) => g.columnas);

export interface DpdPlan {
  id: string;
  profile_id: string;
  creado_por: string | null;
  periodo_inicio: string;
  periodo_fin: string;
  nombre_dpd: string;
  correo_dpd: string;
  url_plan_adjunto: string | null;
  created_at: string;
}

export interface DpdActividad {
  id: string;
  plan_id: string;
  mes: number;
  fase: string;
  descripcion: string;
  verificacion: string | null;
  completada: boolean;
  fecha_completado: string | null;
  observaciones: string | null;
  url_informe: string | null;
  created_at: string;
}

export type DpdActaEstado = "pendiente_firma" | "firmada" | "archivada";

export interface DpdActa {
  id: string;
  plan_id: string;
  actividad_id: string | null;
  numero_acta: string;
  descripcion_hallazgo: string;
  recomendacion: string;
  estado: DpdActaEstado;
  url_acta_generada: string | null;
  url_acta_firmada: string | null;
  created_at: string;
}

export interface DpdInformeBrecha {
  id: string;
  plan_id: string;
  mes: string;
  anio: number;
  hubo_brecha: boolean;
  contenido: string;
  url_informe: string | null;
  created_at: string;
}

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export interface PlanImplementacion {
  id: string;
  profile_id: string;
  tipo: "rat" | "riesgos" | "documentos";
  actividad_origen_id: string | null;
  titulo: string;
  responsable: string | null;
  departamento: string | null;
  actividad_nombre: string | null;
  actividad_realizar: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string;
  created_at: string;
}
