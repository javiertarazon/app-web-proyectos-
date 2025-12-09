import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ProjectResponse, FileAttachment, ChatMessage, ClarificationResponse } from "../types";
import { getStandardsContext } from "../data/coveninStandards";

const MODEL_NAME = "gemini-3-pro-preview";

// Helper to get AI instance
const getAI = () => {
  if (!process.env.API_KEY) {
    throw new Error("La variable de entorno API_KEY no está configurada.");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
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

// 1. PHASE ONE: GENERATE CLARIFYING QUESTIONS (STRUCTURED)
export const generateClarifyingQuestions = async (chatHistory: ChatMessage[], attachments: FileAttachment[] = []): Promise<ClarificationResponse> => {
  const ai = getAI();
  const standardsContext = getStandardsContext();

  // Convert ChatHistory to a single narrative context
  const conversationContext = chatHistory.map(msg => `${msg.role === 'user' ? 'CLIENTE' : 'INGENIERO'}: ${msg.text}`).join('\n\n');

  const systemInstruction = `
    Eres un Ingeniero Senior Auditor. Tu objetivo es obtener toda la información técnica necesaria para generar un proyecto ejecutivo (Memoria, Cálculos, Presupuesto).
    
    Analiza la conversación.
    1. Si falta información crítica (resistencias, voltajes, áreas, tipos de material), genera preguntas de SELECCIÓN SIMPLE (Multiple Choice) para agilizar la respuesta del usuario.
    2. Si ya tienes suficiente información para un anteproyecto sólido, marca 'isReady' como true.
    
    Tus preguntas deben ser técnicas, basadas en normas COVENIN, pero fáciles de responder (opciones claras).
    Máximo 3 preguntas por turno.
  `;

  const clarificationSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      message: { type: Type.STRING, description: "Breve mensaje introductorio o de confirmación." },
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING, description: "La pregunta técnica" },
            options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Opciones de respuesta sugeridas" }
          },
          required: ["id", "text", "options"]
        }
      },
      isReady: { type: Type.BOOLEAN, description: "True si ya se tiene suficiente información para generar el informe final." }
    },
    required: ["message", "questions", "isReady"]
  };

  const parts: any[] = [
     { text: `CONTEXTO NORMATIVO: ${standardsContext}` },
     { text: `HISTORIAL DE CONVERSACIÓN: ${conversationContext}` }
  ];

  attachments.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } }));

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
  const standardsContext = getStandardsContext();

  // Convert ChatHistory to a single narrative context
  const conversationContext = chatHistory.map(msg => `${msg.role === 'user' ? 'CLIENTE' : 'INGENIERO'}: ${msg.text}`).join('\n\n');

  const systemInstruction = `
    Eres un Ingeniero Civil/Eléctrico Senior experto en redacción de proyectos ejecutivos y licitaciones.
    
    TU TAREA: Generar un Expediente Técnico completo basado en la conversación sostenida con el cliente.
    
    ESTRUCTURA OBLIGATORIA DE LA MEMORIA DESCRIPTIVA (Basada en Guía de Protección Civil):
    1. INTRODUCCIÓN, 2. EMPRESA/INGENIERO, 3. PREDIO, 4. MARCO LEGAL (COVENIN), 5. DESCRIPCIÓN TÉCNICA, 6. SERVICIOS, 7. ETAPAS.
    
    DIRECTRICES PARA APU Y PRESUPUESTO:
    - Generar partidas con códigos COVENIN reales o simulados.
    - Desglose estricto de Materiales, Equipos y Mano de Obra.
    - Mano de Obra: Incluir porcentajes realistas de Prestaciones (CAS ~200% para Venezuela) y Bono Alimentación.
    
    INPUT: Historial de conversación donde se definieron los detalles del proyecto.
  `;

  const parts: any[] = [
    { text: `CONTEXTO NORMATIVO: ${standardsContext}` },
    { text: `HISTORIAL DE ENTREVISTA CON CLIENTE: ${conversationContext}` }
  ];

  attachments.forEach(att => parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } }));

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
    throw new Error("El análisis de ingeniería falló. Por favor intente nuevamente o reduzca el tamaño de los adjuntos.");
  }
};

// 3. PHASE THREE: MODIFY EXISTING DATA
export const modifyEngineeringData = async (currentData: ProjectResponse, userRequest: string): Promise<ProjectResponse> => {
  const ai = getAI();
  
  const systemInstruction = `
    Eres un asistente de ingeniería que modifica estructuras de datos JSON.
    Recibirás un objeto JSON con los datos de un proyecto (ProjectResponse) y una solicitud de cambio del usuario.
    
    Tu tarea es aplicar INTELIGENTEMENTE los cambios solicitados al JSON.
    
    Reglas:
    1. Si el usuario pide cambiar un valor numérico (ej: "Sube el IVA al 16%"), actualiza el campo correspondiente.
    2. Si pide agregar una partida, genera una nueva partida COVENIN completa con APU coherente y agrégala al array 'presupuesto'.
    3. Si pide cambiar un parámetro de cálculo (ej: "El concreto es de 250kg/cm2"), actualiza la memoria descriptiva y busca si hay items en memoriaCalculo que deban cambiar.
    4. MANTÉN la estructura exacta del JSON.
    
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
    throw new Error("La modificación falló debido a un error de conexión con el modelo.");
  }
}
