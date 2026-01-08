import { GoogleGenAI, Type, Schema, GenerateContentResponse } from "@google/genai";
import { ProjectResponse, FileAttachment, ChatMessage, ClarificationResponse } from "../types";
import { STANDARDS_DB, SUPPORTED_COUNTRIES } from "../data/standardsData";
import { getMaterialCatalogsContext } from "../data/materialsCatalogs";
import { loadSettings } from "../services/settingsService";

const MODEL_NAME = "gemini-3-pro-preview";
const CLARIFICATION_FALLBACK_MODEL = "gemini-2.5-flash";
const MODIFICATION_FALLBACK_MODEL = "gemini-2.5-flash";

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

    const isNetworkError = error.status === 500 || 
                           error.status === 'UNKNOWN' ||
                           (error.message && (
                              error.message.includes('xhr error') || 
                              error.message.includes('Network Error') || 
                              error.message.includes('Failed to fetch') ||
                              error.message.includes('500')
                           ));

    if ((isQuotaError || isNetworkError) && retries > 0) {
      console.warn(`Gemini API Error (${error.status || error.message}). Retrying in ${delay}ms... (${retries} attempts left)`);
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

  // Load External Catalogs (e.g., LLS Electric)
  context += "\n" + getMaterialCatalogsContext() + "\n";

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
    Eres un Auditor Técnico de Ingeniería e Ingeniero Proyectista Senior.
    PAÍS: ${settings.country}.

    TU OBJETIVO: 
    1. Entender el proyecto del usuario.
    2. ANALIZAR CRÍTICAMENTE LOS ARCHIVOS ADJUNTOS (si existen). 
       - Si el usuario sube "Memorias Descriptivas" o "Cómputos Métricos", LÉELOS y busca inconsistencias, faltas de normativa o datos incompletos.
       - Si están incompletos, PREGUNTA al usuario para rellenar los huecos.
       - Si están correctos, úsalos como base.
    
    EJEMPLO DE AUDITORÍA:
    - "He analizado su memoria descriptiva adjunta. Noto que menciona aire acondicionado pero no incluye el cálculo de carga térmica. ¿Desea que lo calculemos basándonos en el área?"
    - "Veo sus cómputos métricos. La partida de concreto no incluye el desperdicio del 5%. ¿Desea corregirlo?"

    Si el usuario dice "Local Gastronómico", DEBES preguntar por:
    1. Trampa de grasas (Obligatorio en restaurantes).
    2. Sistema de Detección de Incendios (Obligatorio >100m2).
    3. Tipo de corriente (Trifásica vs Monofásica para equipos de cocina).
    
    No marques 'isReady' hasta tener datos suficientes para generar un informe profesional completo.
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

  // SYSTEM PROMPT EXTREMADAMENTE ESTRICTO PARA EVITAR RESÚMENES
  const systemInstruction = `
    ROL: INGENIERO DE COSTOS Y PROYECTISTA PRINCIPAL (SENIOR).
    PAÍS: ${settings.country}.

    !!! INSTRUCCIÓN CRÍTICA: PROHIBIDO RESUMIR - DETALLE EXTREMO EN MATERIALES !!!
    El usuario exige una LISTA DE MATERIALES EXHAUSTIVA en cada partida.

    REGLAS DE ORO PARA EL PRESUPUESTO (PARTIDAS):
    1. **ATOMICIDAD**: Desglosa partidas grandes en suministro e instalación.
    2. **FUNCIONALIDAD TOTAL (LLAVE EN MANO)**: Incluye acometidas, tableros, válvulas y pruebas.
    3. **CANTIDAD DE PARTIDAS**: Mínimo 30-80 partidas según el alcance.

    REGLAS ESTRICTAS PARA MATERIALES (APU):
    Debes listar CADA componente físico necesario. 
    - **PROHIBIDO** usar items genéricos como "Global Materiales" o "Kit de Instalación".
    - **Estructura Metálica**: NO pongas solo "Acero". Desglosa: Perfil IPE-120, Pletina de anclaje 20x20cm, Pernos 5/8", Tuercas, Arandelas de presión, Electrodos E7018, Fondo Anticorrosivo, Solvente.
    - **Electricidad**: NO pongas solo "Punto". Desglosa: Tubería EMT 3/4", Curvas EMT, Conectores EMT, Cajetín 4x2, Tornillos Spax, Cable THHN #12, Tirro, Cinta Eléctrica.
    - **Concreto**: Cemento Gris (Saco), Arena Lavada, Piedra Picada, Agua, Aditivos, Clavos 3", Alambre Dulce #18, Madera de encofrado.
    - **Sanitaria**: Tubería PVC, Codos 90, Yee, Teflón, Limpiador PVC, Soldadura líquida PVC, Abrazaderas.
    - **Redes Eléctricas (Media Tensión)**: Utiliza explícitamente los datos de los catálogos cargados (LLS Electric) si aplica. Ejemplo: "Cortacircuito Fusible 15kV LLS Electric", "Eslabón Fusible Tipo K".

    REGLAS PARA MANO DE OBRA:
    - Cuadrillas completas (Maestro + Ayudante + Obrero).

    REGLAS PARA MEMORIAS DE CÁLCULO:
    - Muestra el procedimiento matemático paso a paso.
    - Ejemplo: "Carga Térmica = Area (20m2) * 600 BTU/m2 = 12,000 BTU".

    USA LAS NORMAS ${settings.country} (COVENIN/NEC/ETC) PARA LOS CÓDIGOS DE PARTIDA.
  `;

  const parts: any[] = [
    { text: `NORMATIVA APLICABLE (${settings.country}):\n${standardsContext}` },
    { text: `DATOS DEL PROYECTO (HISTORIAL):\n${conversationContext}` }
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
        maxOutputTokens: 65536 // Max token limit for extensive budgets
      }
    }), 3, 4000); // Increased delay for heavy processing

    if (!response.text) { throw new Error("Sin datos de Gemini"); }

    return JSON.parse(response.text) as ProjectResponse;
  } catch (e) {
    console.error("Generation Error:", e);
    throw new Error("El sistema de ingeniería está procesando un volumen alto de datos. Por favor intenta de nuevo en unos segundos.");
  }
};

// 3. MODIFY PHASE
export const modifyEngineeringData = async (currentData: ProjectResponse, userRequest: string): Promise<ProjectResponse> => {
  const ai = getAI();
  const settings = loadSettings();
  
  const systemInstruction = `
    ROL: Ingeniero de Control de Cambios y Presupuestos (JSON Patcher).
    TAREA: Ejecutar una MODIFICACIÓN QUIRÚRGICA Y PUNTUAL al archivo JSON del proyecto.

    ESTADO ACTUAL: El usuario te proveerá el JSON completo del proyecto actual.
    SOLICITUD PUNTUAL: "${userRequest}".

    PRINCIPIOS DE EDICIÓN OBLIGATORIOS (STRICT MODE):
    1. CONSERVACIÓN ABSOLUTA: Todo lo que NO esté explícitamente relacionado con la solicitud DEBE permanecer IDÉNTICO. 
       
    2. LÓGICA DE ACTUALIZACIÓN:
       - Si se pide "Agregar X": Crea la partida nueva, genera su APU completo y agrégala al array de presupuesto.
       - Si el usuario pide "DETALLAR MATERIALES": Revisa las partidas indicadas y expande la lista de materiales (ej. cambiar "Kit" por tornillos, tuercas, arandelas, etc).
       
    3. COHERENCIA MATEMÁTICA EN CAMBIOS:
       - Si modificas un metrado (Cantidad), recalcula: PrecioTotal = Metrado * PrecioUnitario.
       - Si modificas un costo de material dentro de un APU, recalcula el Precio Unitario de la partida y luego su Precio Total.

    TU RESPUESTA DEBE SER EL JSON COMPLETO (PROJECTRESPONSE) CON LOS CAMBIOS APLICADOS Y EL RESTO INTACTO.
  `;

  const generate = async (model: string) => {
      const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { text: `JSON ACTUAL (ESTADO INICIAL): ${JSON.stringify(currentData)}` },
          { text: `SOLICITUD DE CAMBIO (APLICAR SOLO ESTO): ${userRequest}` }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: projectSchema,
        maxOutputTokens: 65536
      }
    });
    if (!response.text) throw new Error("Sin respuesta de Gemini");
    return JSON.parse(response.text) as ProjectResponse;
  };

  try {
    return await withRetry(() => generate(MODEL_NAME));
  } catch (e) {
    console.warn("Modification with primary model failed, attempting fallback...");
    try {
        return await withRetry(() => generate(MODIFICATION_FALLBACK_MODEL));
    } catch (fallbackError) {
        console.error("Modification Error:", fallbackError);
        throw new Error("Error al modificar el proyecto. Intente nuevamente o realice cambios más pequeños.");
    }
  }
}