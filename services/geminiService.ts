import { GoogleGenAI, Type, Schema, GenerateContentResponse } from "@google/genai";
import { ProjectResponse, FileAttachment, ChatMessage, ClarificationResponse } from "../types";
import { STANDARDS_DB, SUPPORTED_COUNTRIES } from "../data/standardsData";
import { loadSettings } from "../services/settingsService";

const MODEL_NAME = "gemini-3-pro-preview";
const CLARIFICATION_FALLBACK_MODEL = "gemini-2.5-flash";

// Helper to get AI instance
const getAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("La variable de entorno API_KEY no está configurada.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Helper to handle API retries
async function withRetry<T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 2000
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const isQuotaError = error.status === 429 || 
                         error.status === 503 || 
                         error.message?.includes('429') || 
                         error.message?.includes('quota') || 
                         error.message?.includes('RESOURCE_EXHAUSTED') ||
                         error.message?.includes('overloaded');

    if (isQuotaError && retries > 0) {
      console.warn(`Gemini API Quota/Limit hit. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Helper to build context string from settings
const getContextFromSettings = (): string => {
  const settings = loadSettings();
  const countryName = SUPPORTED_COUNTRIES.find(c => c.code === settings.country)?.name || settings.country;
  
  let context = `PAÍS/REGIÓN DEL PROYECTO: ${countryName}\n\n`;
  context += "NORMATIVAS DE REFERENCIA (PRIORIDAD ALTA):\n";
  
  // Load standard library for current country
  const countryStandards = STANDARDS_DB[settings.country];
  if (countryStandards) {
    Object.entries(countryStandards).forEach(([discipline, list]) => {
      context += `\nDISCIPLINA: ${discipline}\n`;
      list.filter(s => s.active).forEach(s => {
        context += `- ${s.code}: ${s.title}\n`;
      });
    });
  }

  // Add custom user files
  if (settings.customStandards.length > 0) {
    context += "\nDOCUMENTOS ADICIONALES DEL USUARIO (Ver adjuntos):\n";
    settings.customStandards.forEach(f => context += `- ${f.name}\n`);
  }

  return context;
};

// --- SHARED SCHEMAS ---

const apuItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    descripcion: { type: Type.STRING },
    unidad: { type: Type.STRING },
    cantidad: { type: Type.NUMBER },
    costoUnitario: { type: Type.NUMBER },
    desperdicio: { type: Type.NUMBER },
    total: { type: Type.NUMBER }
  },
  required: ["descripcion", "unidad", "cantidad", "costoUnitario", "total"]
};

const projectSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    projectTitle: { type: Type.STRING },
    discipline: { type: Type.STRING },
    memoriaDescriptiva: {
      type: Type.OBJECT,
      properties: {
        introduccion: { type: Type.STRING },
        informacionEmpresa: {
          type: Type.OBJECT,
          properties: {
            nombreIngeniero: { type: Type.STRING },
            civ: { type: Type.STRING },
            razonSocial: { type: Type.STRING },
            direccion: { type: Type.STRING }
          },
          required: ["nombreIngeniero"]
        },
        descripcionPredio: { type: Type.STRING },
        marcoLegal: { type: Type.ARRAY, items: { type: Type.STRING } },
        descripcionProyecto: { type: Type.STRING, description: "Descripción técnica detallada de la arquitectura y acabados." },
        
        // NEW FIELDS FOR DETAILED CALCULATIONS
        calculosEstructuralesDetallados: { type: Type.STRING, description: "Desarrollo matemático completo de cargas, predimensionado y volúmenes." },
        calculosElectricosDetallados: { type: Type.STRING, description: "Estudio de Cargas paso a paso. Iluminación + Tomas + Motores. Cálculo de KVA." },
        calculosSanitariosDetallados: { type: Type.STRING, description: "Cálculo de Dotación Diaria (Lts/día) según normas. Unidades de Gasto. Capacidad de Tanque." },
        calculosMecanicosDetallados: { type: Type.STRING, description: "Cálculo de Carga Térmica (BTU). Renovaciones de aire." },

        serviciosRequeridos: { type: Type.STRING },
        etapasConstructivas: { type: Type.ARRAY, items: { type: Type.STRING } },
        conclusiones: { type: Type.STRING }
      },
      required: ["introduccion", "informacionEmpresa", "descripcionPredio", "marcoLegal", "descripcionProyecto", "calculosEstructuralesDetallados", "calculosElectricosDetallados", "calculosSanitariosDetallados", "calculosMecanicosDetallados", "serviciosRequeridos", "etapasConstructivas"]
    },
    memoriaCalculo: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          value: { type: Type.NUMBER },
          unit: { type: Type.STRING },
          formula: { type: Type.STRING },
          description: { type: Type.STRING },
          critical: { type: Type.BOOLEAN },
          reference: { type: Type.STRING }
        },
        required: ["name", "value", "unit", "formula", "description", "critical", "reference"]
      }
    },
    presupuestoConfig: {
      type: Type.OBJECT,
      properties: {
        porcentajeAnticipo: { type: Type.NUMBER },
        diasValidez: { type: Type.NUMBER },
        porcentajeIVA: { type: Type.NUMBER }
      },
      required: ["porcentajeAnticipo", "diasValidez", "porcentajeIVA"]
    },
    presupuesto: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          codigo: { type: Type.STRING },
          descripcion: { type: Type.STRING },
          unidad: { type: Type.STRING },
          metrado: { type: Type.NUMBER },
          precioUnitario: { type: Type.NUMBER },
          precioTotal: { type: Type.NUMBER },
          factorAjuste: { type: Type.NUMBER },
          apu: {
            type: Type.OBJECT,
            properties: {
              rendimiento: { type: Type.NUMBER },
              rendimientoUnidad: { type: Type.STRING },
              laborCASPorcentaje: { type: Type.NUMBER },
              laborCestaTicket: { type: Type.NUMBER },
              administracionPorcentaje: { type: Type.NUMBER },
              utilidadPorcentaje: { type: Type.NUMBER },
              materiales: { type: Type.ARRAY, items: apuItemSchema },
              equipos: { type: Type.ARRAY, items: apuItemSchema },
              manoDeObra: { type: Type.ARRAY, items: apuItemSchema }
            },
            required: ["rendimiento", "rendimientoUnidad", "laborCASPorcentaje", "laborCestaTicket", "administracionPorcentaje", "utilidadPorcentaje", "materiales", "equipos", "manoDeObra"]
          }
        },
        required: ["codigo", "descripcion", "unidad", "metrado", "precioUnitario", "precioTotal", "factorAjuste", "apu"]
      }
    },
    normativaAplicable: { type: Type.ARRAY, items: { type: Type.STRING } },
    conclusiones: { type: Type.STRING }
  },
  required: ["projectTitle", "discipline", "memoriaDescriptiva", "memoriaCalculo", "presupuesto", "presupuestoConfig", "normativaAplicable", "conclusiones"]
};

// 1. CLARIFICATION PHASE
export const generateClarifyingQuestions = async (chatHistory: ChatMessage[], attachments: FileAttachment[] = []): Promise<ClarificationResponse> => {
  const ai = getAI();
  const standardsContext = getContextFromSettings();
  const settings = loadSettings();

  const conversationContext = chatHistory.map(msg => `${msg.role === 'user' ? 'CLIENTE' : 'INGENIERO'}: ${msg.text}`).join('\n\n');

  const systemInstruction = `
    Eres un Auditor Técnico de Ingeniería.
    TU OBJETIVO: Asegurar que NO existan ambigüedades en el proyecto.
    PAÍS: ${settings.country}.
    
    Si el usuario dice "Local Gastronómico", DEBES preguntar por:
    1. Trampa de grasas (Obligatorio en restaurantes).
    2. Sistema de Detección de Incendios (Obligatorio >100m2).
    3. Tipo de corriente (Trifásica vs Monofásica para equipos de cocina).
    4. Acabados sanitarios en cocina (Curva sanitaria, pintura epóxica).
    
    No marques 'isReady' hasta tener datos para generar >50 partidas.
  `;

  const clarificationSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      message: { type: Type.STRING },
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["id", "text", "options"]
        }
      },
      isReady: { type: Type.BOOLEAN }
    },
    required: ["message", "questions", "isReady"]
  };

  const parts: any[] = [
     { text: `NORMATIVA:\n${standardsContext}` },
     { text: `HISTORIAL:\n${conversationContext}` }
  ];

  attachments.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } }));
  settings.customStandards.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } }));

  const generate = async (model: string) => {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: { 
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: clarificationSchema
      }
    });
    if (!response.text) throw new Error("Sin respuesta de Gemini");
    return JSON.parse(response.text) as ClarificationResponse;
  };

  try {
    return await withRetry(() => generate(MODEL_NAME));
  } catch (error) {
    console.warn("Primary model quota exceeded, attempting fallback to Flash...");
    try {
      return await withRetry(() => generate(CLARIFICATION_FALLBACK_MODEL));
    } catch (fallbackError) {
      console.error("Clarification Error:", fallbackError);
      throw new Error("El servicio de ingeniería está saturado. Por favor espera 30 segundos e intenta de nuevo.");
    }
  }
};

// 2. GENERATION PHASE
export const generateEngineeringData = async (chatHistory: ChatMessage[], attachments: FileAttachment[] = []): Promise<ProjectResponse> => {
  const ai = getAI();
  const standardsContext = getContextFromSettings();
  const settings = loadSettings();

  const conversationContext = chatHistory.map(msg => `${msg.role === 'user' ? 'CLIENTE' : 'INGENIERO'}: ${msg.text}`).join('\n\n');

  // SYSTEM PROMPT AGRESIVO PARA CÁLCULOS Y DESGLOSE
  const systemInstruction = `
    ACTÚA COMO UN INGENIERO CALCULISTA Y PRESUPUESTISTA SENIOR.
    
    EL USUARIO HA RECHAZADO INFORMES ANTERIORES POR SER "RESÚMENES".
    TU META ES LA **GRANULARIDAD EXTREMA** Y LA **JUSTIFICACIÓN ARITMÉTICA**.

    --- INSTRUCCIONES PARA MEMORIA DE CÁLCULO (Nuevos Campos de Texto) ---
    En los campos 'calculosEstructuralesDetallados', 'calculosElectricosDetallados', etc., NO escribas solo el resultado.
    DEBES ESCRIBIR LA SÁBANA DE CÁLCULO:
    
    INCORRECTO: "Carga Eléctrica: 90kVA".
    CORRECTO:
    "1. Carga de Iluminación:
       - Área Salón: 80m2 x 30W/m2 = 2400W
       - Área Cocina: 40m2 x 50W/m2 = 2000W
    2. Carga de Tomacorrientes:
       - 15 Tomas Generales x 180W = 2700W
       - 6 Tomas Especiales Cocina x 1500W = 9000W
    3. Carga Fuerza Motriz (Aires):
       - Equipo 5 Ton (18000 BTU) = 6500W
    4. SUMATORIA TOTAL = ...
    5. APLICACIÓN DE FACTOR DE DEMANDA (NEC Tablas): 2400W x 100% + ..."
    
    HAZ ESTO PARA TODAS LAS DISCIPLINAS (AGUA, ELECTRICIDAD, CONCRETO).

    --- INSTRUCCIONES PARA EL PRESUPUESTO (PARTIDAS) ---
    Genera entre 50 y 100 partidas. DESGLOSA TODO.
    
    NO AGRUPES "Punto Eléctrico".
    Genera:
    1. E.X.X Suministro de Tubería EMT 1/2".
    2. E.X.X Instalación de Tubería EMT 1/2".
    3. E.X.X Suministro de Cajetines Metálicos 4x2".
    4. E.X.X Suministro de Cable THW #12 AWG.
    5. E.X.X Suministro de Interruptores Dobles.
    
    NO AGRUPES "Baño".
    Genera:
    1. E.X.X Puntos de Aguas Blancas 1/2".
    2. E.X.X Puntos de Aguas Negras 4".
    3. E.X.X Suministro WC Tanque Bajo.
    4. E.X.X Instalación de WC.
    5. E.X.X Construcción de Revestimiento en Paredes (Cerámica).

    --- APU (Análisis de Precios) ---
    - En Materiales: Incluye siempre "Pegamento", "Electrodos", "Tipe", "Solventes" según corresponda. No pongas solo el material principal.
    - Mano de Obra: Cuadrillas realistas (Ayudante + Maestro).

    USA EL CONTEXTO DEL CHAT PARA DETERMINAR EL ALCANCE REAL (Ej: Si es 150m2 Restaurante, asume Cocina Industrial, Baños Públicos H/M, Baño Empleados, Barra, Salón).
  `;

  const parts: any[] = [
    { text: `NORMATIVA APLEICABLE (${settings.country}):\n${standardsContext}` },
    { text: `DATOS DEL PROYECTO:\n${conversationContext}` }
  ];

  attachments.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } }));
  settings.customStandards.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } }));

  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: parts },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: projectSchema,
        // Removed thinkingConfig for gemini-3-pro to avoid quota issues and comply with guidelines
        maxOutputTokens: 65536
      }
    }), 3, 3000); // 3 retries, starting at 3s delay

    if (!response.text) { throw new Error("Sin datos de Gemini"); }

    return JSON.parse(response.text) as ProjectResponse;
  } catch (e) {
    console.error("Generation Error:", e);
    throw new Error("El sistema de ingeniería está sobrecargado (Error 429). Intenta reducir el número de archivos adjuntos o espera unos minutos.");
  }
};

// 3. MODIFY PHASE
export const modifyEngineeringData = async (currentData: ProjectResponse, userRequest: string): Promise<ProjectResponse> => {
  const ai = getAI();
  const settings = loadSettings();
  
  const systemInstruction = `
    Eres un Ingeniero Auditor Senior.
    PAÍS: ${settings.country}.
    
    MODIFICACIÓN SOLICITADA: "${userRequest}".
    
    Reglas:
    1. Si el usuario pide cambiar un material (ej. "Pisos de Mármol"), actualiza:
       - La Memoria Descriptiva (Acabados).
       - El Presupuesto (Elimina partida vieja, crea partidas nuevas de suministro, instalación, pulitura).
       - Los APU (Materiales nuevos, rendimientos diferentes).
    2. Si pide "Recalcular Tanque", actualiza 'calculosSanitariosDetallados' mostrando la nueva aritmética.
  `;

  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { text: `JSON ACTUAL: ${JSON.stringify(currentData)}` },
          { text: `SOLICITUD: ${userRequest}` }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: projectSchema,
        // thinkingConfig removed
        maxOutputTokens: 65536
      }
    }));

    if (!response.text) { throw new Error("Sin respuesta"); }
    return JSON.parse(response.text) as ProjectResponse;
  } catch (e) {
    console.error("Modification Error:", e);
    throw new Error("Error al modificar el proyecto debido a saturación de servicios.");
  }
}
