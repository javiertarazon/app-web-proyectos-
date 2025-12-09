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
  desperdicio?: number; // Porcentaje de desperdicio (Solo materiales)
  total: number;
}

export interface APU {
  materiales: APUItem[];
  equipos: APUItem[];
  manoDeObra: APUItem[];
  rendimiento: number; 
  rendimientoUnidad: string; // ej. "m3/dia"
  
  // Parametros Laborales Específicos (Estilo Lulo/Venezuela)
  laborCASPorcentaje: number; // Costos Asociados al Salario (Prestaciones Sociales)
  laborCestaTicket: number; // Bono de Alimentación (Valor monetario por jornada)

  // Parametros Indirectos
  administracionPorcentaje: number; 
  utilidadPorcentaje: number;       
}

export interface Partida {
  codigo: string;
  descripcion: string;
  unidad: string;
  metrado: number;
  precioUnitario: number;
  precioTotal: number;
  factorAjuste: number; // Factor de ajuste/contingencia porcentual
  apu: APU;
}

export interface CompanyInfo {
  nombreIngeniero: string;
  civ?: string; // Colegio de Ingenieros
  razonSocial?: string;
  direccion?: string;
}

export interface MemoriaDescriptiva {
  introduccion: string;
  informacionEmpresa: CompanyInfo;
  descripcionPredio: string; // Ubicación, topografía, colindancias
  marcoLegal: string[]; // Leyes y normas
  descripcionProyecto: string; // Descripción espacial y técnica detallada
  descripcionEstructural?: string; // O descripción del sistema (eléctrico/sanitario)
  serviciosRequeridos: string; // Agua, luz, saneamiento
  etapasConstructivas: string[]; // Cronograma lógico
  conclusiones: string;
}

export interface PresupuestoConfig {
  porcentajeAnticipo: number;
  diasValidez: number;
  porcentajeIVA: number;
}

export interface ProjectResponse {
  id?: string; // Unique ID for storage
  lastModified?: string; // ISO Date string
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
  DASHBOARD = 'DASHBOARD',
  SETTINGS = 'SETTINGS', // New Settings Menu
  INPUT = 'INPUT',
  CLARIFYING = 'CLARIFYING',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface ClarificationQuestion {
  id: string;
  text: string;
  options: string[];
}

export interface ClarificationResponse {
  message: string;
  questions: ClarificationQuestion[];
  isReady: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  clarificationData?: ClarificationResponse;
}

// --- SETTINGS TYPES ---

export type CountryCode = 'VE' | 'US' | 'ES' | 'MX' | 'INTL';
export type Discipline = 'CIVIL' | 'ELECTRICA' | 'MECANICA' | 'SISTEMAS' | 'TELECOM';

export interface Standard {
  code: string;
  title: string;
  url?: string; // Optional external link
  active: boolean; // If selected for the project context
}

export interface AppSettings {
  country: CountryCode;
  customStandards: FileAttachment[]; // Uploaded PDFs/TXTs for persistent context
  activeDisciplines: Discipline[];
}
