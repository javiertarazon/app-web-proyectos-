export interface CalculationItem {
  name: string;
  value: number | string;
  unit: string;
  formula: string;
  description: string;
  critical: boolean;
  reference: string;
}

export interface APUItem {
  descripcion: string;
  unidad: string;
  cantidad: number;
  costoUnitario: number;
  total: number;
}

export interface APU {
  materiales: APUItem[];
  equipos: APUItem[];
  manoDeObra: APUItem[];
  rendimiento: string;
  administracionPorcentaje: number; // Porcentaje de Gastos Administrativos
  utilidadPorcentaje: number;       // Porcentaje de Utilidad (Ganancia)
}

export interface Partida {
  codigo: string;
  descripcion: string;
  unidad: string;
  metrado: number;
  precioUnitario: number;
  precioTotal: number;
  apu: APU;
}

export interface MemoriaDescriptiva {
  objetivo: string;
  alcance: string;
  ubicacion: string;
  metodologiaEjecucion: string;
  especificacionesTecnicas: string[];
}

export interface PresupuestoConfig {
  porcentajeAnticipo: number;
  diasValidez: number;
  porcentajeIVA: number;
}

export interface ProjectResponse {
  projectTitle: string;
  discipline: string;
  memoriaDescriptiva: MemoriaDescriptiva;
  memoriaCalculo: CalculationItem[];
  presupuesto: Partida[];
  presupuestoConfig: PresupuestoConfig;
  normativaAplicable: string[];
  conclusiones: string;
}

export interface FileAttachment {
  name: string;
  mimeType: string;
  data: string; // Base64 string without prefix
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
