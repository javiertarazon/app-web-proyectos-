import { GoogleGenAI, Type } from "@google/genai";
import { ProjectResponse, FileAttachment } from "../types";
import { getStandardsContext } from "../data/coveninStandards";

const MODEL_NAME = "gemini-3-pro-preview";

export const generateEngineeringData = async (projectDescription: string, attachments: FileAttachment[] = []): Promise<ProjectResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("La variable de entorno API_KEY no está configurada.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Load the COVENIN database context
  const standardsContext = getStandardsContext();

  const systemInstruction = `
    Eres un Ingeniero Civil Senior y Gerente de Proyectos experto en costos, licitaciones y normativa venezolana.
    Tu objetivo es generar un **Expediente Técnico Ejecutivo** altamente detallado.
    
    ${standardsContext}
    
    DIRECTRICES DE CONTENIDO:
    1. **MEMORIA DESCRIPTIVA EXTENSA**: No seas breve. Genera parráfos explicativos largos y técnicos.
       - **Alcance**: Detalla minuciosamente cada fase del trabajo.
       - **Metodología**: Explica el procedimiento constructivo paso a paso, maquinaria a usar, medidas de seguridad.
       - **Ubicación**: Describe el contexto geográfico y condiciones del terreno supuestas.
    
    2. **ANÁLISIS DE PRECIOS UNITARIOS (APU) PROFUNDO**:
       - Desglosa materiales menores (clavos, alambre, etc.).
       - Incluye "Herramientas Menores" como porcentaje de mano de obra.
       - Define **Gastos Administrativos** (aprox 12-15%) y **Utilidad/Ganancia** (aprox 10-15%) explícitamente en el esquema.
    
    3. **CONDICIONES DE LA OFERTA**:
       - Establece un **Anticipo** estándar (usualmente 30% a 50%).
       - Establece **Validez de la Oferta** (usualmente 30, 45 o 60 días).
       - Incluye **IVA** (16% para Venezuela).
    
    4. **Precios y Normativa**:
       - Usa precios de mercado actuales en USD.
       - Cita normas COVENIN en la memoria de cálculo.
       - Usa codificación de partidas estilo COVENIN 2000.
    
    FORMATO: JSON estricto. Texto en ESPAÑOL TÉCNICO FORMAL.
  `;

  // Helper helper to define APU Item schema easily
  const apuItemSchema = {
    type: Type.OBJECT,
    properties: {
      descripcion: { type: Type.STRING },
      unidad: { type: Type.STRING },
      cantidad: { type: Type.NUMBER },
      costoUnitario: { type: Type.NUMBER },
      total: { type: Type.NUMBER }
    },
    required: ["descripcion", "unidad", "cantidad", "costoUnitario", "total"]
  };

  // Construct parts: Text prompt + Attachments
  const parts: any[] = [
    { text: `Descripción del Proyecto: ${projectDescription}` }
  ];

  // Add attachments to parts
  attachments.forEach(att => {
    parts.push({
      inlineData: {
        mimeType: att.mimeType,
        data: att.data
      }
    });
  });

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: { parts: parts },
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          projectTitle: { type: Type.STRING },
          discipline: { type: Type.STRING },
          memoriaDescriptiva: {
            type: Type.OBJECT,
            properties: {
              objetivo: { type: Type.STRING, description: "Objetivo general y específicos del proyecto" },
              alcance: { type: Type.STRING, description: "Descripción MUY detallada y extensa de los trabajos incluidos" },
              ubicacion: { type: Type.STRING, description: "Descripción detallada del sitio y condiciones" },
              metodologiaEjecucion: { type: Type.STRING, description: "Procedimiento constructivo detallado paso a paso" },
              especificacionesTecnicas: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["objetivo", "alcance", "ubicacion", "metodologiaEjecucion", "especificacionesTecnicas"]
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
              porcentajeAnticipo: { type: Type.NUMBER, description: "Porcentaje de anticipo (ej. 30)" },
              diasValidez: { type: Type.NUMBER, description: "Días de validez de la oferta (ej. 30)" },
              porcentajeIVA: { type: Type.NUMBER, description: "Porcentaje de impuesto IVA (ej. 16)" }
            },
            required: ["porcentajeAnticipo", "diasValidez", "porcentajeIVA"]
          },
          presupuesto: {
            type: Type.ARRAY,
            description: "Lista de partidas usando codificación COVENIN 2000",
            items: {
              type: Type.OBJECT,
              properties: {
                codigo: { type: Type.STRING },
                descripcion: { type: Type.STRING },
                unidad: { type: Type.STRING },
                metrado: { type: Type.NUMBER },
                precioUnitario: { type: Type.NUMBER },
                precioTotal: { type: Type.NUMBER },
                apu: {
                  type: Type.OBJECT,
                  properties: {
                    rendimiento: { type: Type.STRING },
                    administracionPorcentaje: { type: Type.NUMBER, description: "Porcentaje de gastos administrativos (ej. 15)" },
                    utilidadPorcentaje: { type: Type.NUMBER, description: "Porcentaje de utilidad/ganancia (ej. 10)" },
                    materiales: { type: Type.ARRAY, items: apuItemSchema },
                    equipos: { type: Type.ARRAY, items: apuItemSchema },
                    manoDeObra: { type: Type.ARRAY, items: apuItemSchema }
                  },
                  required: ["rendimiento", "administracionPorcentaje", "utilidadPorcentaje", "materiales", "equipos", "manoDeObra"]
                }
              },
              required: ["codigo", "descripcion", "unidad", "metrado", "precioUnitario", "precioTotal", "apu"]
            }
          },
          normativaAplicable: { type: Type.ARRAY, items: { type: Type.STRING } },
          conclusiones: { type: Type.STRING }
        },
        required: ["projectTitle", "discipline", "memoriaDescriptiva", "memoriaCalculo", "presupuesto", "presupuestoConfig", "normativaAplicable", "conclusiones"]
      }
    }
  });

  if (!response.text) {
    throw new Error("No se recibieron datos de Gemini.");
  }

  try {
    return JSON.parse(response.text) as ProjectResponse;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("El análisis de ingeniería falló debido a un error en el formato de datos.");
  }
};
