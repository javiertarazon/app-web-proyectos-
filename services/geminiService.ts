import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ProjectResponse, FileAttachment, ChatMessage, ClarificationResponse } from "../types";
import { STANDARDS_DB, SUPPORTED_COUNTRIES } from "../data/standardsData";
import { loadSettings } from "../services/settingsService";

const MODEL_NAME = "gemini-3-pro-preview";

// Helper to get AI instance
const getAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("La variable de entorno API_KEY no está configurada.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

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

  // Add custom user files if they are small text, otherwise they are attachments
  // We list them here so AI knows they exist
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
        descripcionProyecto: { type: Type.STRING },
        descripcionEstructural: { type: Type.STRING },
        serviciosRequeridos: { type: Type.STRING },
        etapasConstructivas: { type: Type.ARRAY, items: { type: Type.STRING } },
        conclusiones: { type: Type.STRING }
      },
      required: ["introduccion", "informacionEmpresa", "descripcionPredio", "marcoLegal", "descripcionProyecto", "serviciosRequeridos", "etapasConstructivas"]
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

// 1. PHASE ONE: GENERATE CLARIFYING QUESTIONS
export const generateClarifyingQuestions = async (chatHistory: ChatMessage[], attachments: FileAttachment[] = []): Promise<ClarificationResponse> => {
  const ai = getAI();
  const standardsContext = getContextFromSettings();
  const settings = loadSettings();

  // Convert ChatHistory to a single narrative context
  const conversationContext = chatHistory.map(msg => `${msg.role === 'user' ? 'CLIENTE' : 'INGENIERO'}: ${msg.text}`).join('\n\n');

  const systemInstruction = `
    Eres un Ingeniero Senior Auditor. Tu objetivo es obtener toda la información técnica necesaria para generar un proyecto ejecutivo.
    
    ESTÁS OPERANDO BAJO NORMATIVAS DE: ${settings.country}.
    
    Analiza la conversación.
    1. Si falta información crítica, genera preguntas de SELECCIÓN SIMPLE.
    2. Si ya tienes suficiente información para un anteproyecto sólido, marca 'isReady' como true.
    
    Tus preguntas deben ser técnicas, basadas en las normas listadas en el contexto, pero fáciles de responder.
  `;

  const clarificationSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      message: { type: Type.STRING, description: "Breve mensaje introductorio." },
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
     { text: `CONTEXTO NORMATIVO ACTIVO:\n${standardsContext}` },
     { text: `HISTORIAL DE CONVERSACIÓN: ${conversationContext}` }
  ];

  attachments.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } }));
  // Also add custom standards from settings if they are images/pdfs (re-attaching them here ensures AI sees them)
  settings.customStandards.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } }));

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: { 
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: clarificationSchema
      }
    });

    if (!response.text) { throw new Error("No se recibieron datos de Gemini."); }
    return JSON.parse(response.text) as ClarificationResponse;
  } catch (error) {
    console.error("API Error in Clarification:", error);
    throw new Error("Error de conexión con el asistente de ingeniería.");
  }
};

// 2. PHASE TWO: GENERATE FULL ENGINEERING DATA
export const generateEngineeringData = async (chatHistory: ChatMessage[], attachments: FileAttachment[] = []): Promise<ProjectResponse> => {
  const ai = getAI();
  const standardsContext = getContextFromSettings();
  const settings = loadSettings();

  const conversationContext = chatHistory.map(msg => `${msg.role === 'user' ? 'CLIENTE' : 'INGENIERO'}: ${msg.text}`).join('\n\n');

  const systemInstruction = `
    Eres un Ingeniero Senior experto en proyectos ejecutivos.
    
    TU TAREA: Generar un Expediente Técnico completo.
    PAÍS: ${settings.country} (Usa la moneda y terminología local si aplica, ej. Bs para VE, $ para US/INTL, € para ES).
    
    ESTRUCTURA OBLIGATORIA:
    1. INTRODUCCIÓN, 2. EMPRESA/INGENIERO, 3. PREDIO, 4. MARCO LEGAL (Usa las normas provistas en el contexto), 5. DESCRIPCIÓN TÉCNICA, 6. SERVICIOS, 7. ETAPAS.
    
    DIRECTRICES:
    - Generar partidas con códigos reales o simulados según la norma local.
    - Desglose estricto de Materiales, Equipos y Mano de Obra.
    - Mano de Obra: Ajustar porcentajes de prestaciones sociales según el país seleccionado.
    
    INPUT: Historial de conversación.
  `;

  const parts: any[] = [
    { text: `CONTEXTO NORMATIVO:\n${standardsContext}` },
    { text: `HISTORIAL DE ENTREVISTA: ${conversationContext}` }
  ];

  attachments.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } }));
  settings.customStandards.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } }));

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: parts },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: projectSchema
      }
    });

    if (!response.text) { throw new Error("No se recibieron datos de Gemini."); }

    return JSON.parse(response.text) as ProjectResponse;
  } catch (e) {
    console.error("API Error in Generation:", e);
    throw new Error("El análisis de ingeniería falló.");
  }
};

// 3. PHASE THREE: MODIFY EXISTING DATA (No changes needed, logic is generic)
export const modifyEngineeringData = async (currentData: ProjectResponse, userRequest: string): Promise<ProjectResponse> => {
  const ai = getAI();
  const settings = loadSettings();
  
  const systemInstruction = `
    Eres un asistente de ingeniería que modifica estructuras de datos JSON.
    PAÍS CONTEXTO: ${settings.country}.
    
    Tu tarea es aplicar los cambios solicitados al JSON manteniendo la integridad técnica.
    
    Devuelve ÚNICAMENTE el JSON actualizado.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { text: `CURRENT DATA JSON: ${JSON.stringify(currentData)}` },
          { text: `USER MODIFICATION REQUEST: ${userRequest}` }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: projectSchema
      }
    });

    if (!response.text) { throw new Error("No se recibieron datos de Gemini."); }

    return JSON.parse(response.text) as ProjectResponse;
  } catch (e) {
    console.error("API Error in Modification:", e);
    throw new Error("La modificación falló.");
  }
}
