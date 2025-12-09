export const COVENIN_STANDARDS = {
  CIVIL: [
    { code: "COVENIN 1756-1:2019", title: "Edificaciones Sismorresistentes (Requisitos)" },
    { code: "COVENIN 1753:2006", title: "Proyecto y Construcción de Obras en Concreto Estructural" },
    { code: "COVENIN 1618:1998", title: "Estructuras de Acero para Edificaciones" },
    { code: "COVENIN 2002:1988", title: "Criterios y Acciones Mínimas para el Proyecto de Edificaciones (Viento, Cargas)" },
    { code: "COVENIN 2000:1987", title: "Sector Construcción: Mediciones y Codificación de Partidas" },
    { code: "COVENIN 2500:1993", title: "Guía para la evaluación del sistema de impermeabilización" },
    { code: "COVENIN 1750:1987", title: "Especificaciones Generales para Edificios" }
  ],
  ELECTRICA: [
    { code: "COVENIN 200:2009", title: "Código Eléctrico Nacional (CEN)" },
    { code: "COVENIN 540:2004", title: "Puesta a Tierra de Sistemas Eléctricos" },
    { code: "COVENIN 542:1999", title: "Cajas, Conduletes y Accesorios" },
    { code: "COVENIN 1568:2005", title: "Tableros de Baja Tensión" },
    { code: "COVENIN 3389:1998", title: "Iluminancia en Tareas y Áreas de Trabajo" },
    { code: "COVENIN 159:1997", title: "Tensiones Normalizadas del Servicio Eléctrico" }
  ],
  MECANICA_SEGURIDAD: [
    { code: "COVENIN 253:1999", title: "Codificación para la Identificación de Tuberías" },
    { code: "COVENIN 810:1998", title: "Características de los Medios de Escape" },
    { code: "COVENIN 823:2002", title: "Sistemas de Detección, Alarma y Extinción de Incendios" },
    { code: "COVENIN 2245:1990", title: "Escaleras, Rampas y Pasarelas: Requisitos de Seguridad" },
    { code: "COVENIN 928:1978", title: "Instalaciones de Sistemas de Tuberías para Suministro de Gas" },
    { code: "COVENIN 1329:1989", title: "Sistemas de Protección Contra Incendios en Edificaciones" }
  ]
};

export const getStandardsContext = (): string => {
  let context = "BASE DE DATOS NORMATIVA VENEZOLANA (COVENIN) OBLIGATORIA:\n";
  
  context += "CIVIL/ESTRUCTURAL:\n";
  COVENIN_STANDARDS.CIVIL.forEach(s => context += `- ${s.code}: ${s.title}\n`);
  
  context += "\nELÉCTRICA:\n";
  COVENIN_STANDARDS.ELECTRICA.forEach(s => context += `- ${s.code}: ${s.title}\n`);
  
  context += "\nMECÁNICA Y SEGURIDAD INDUSTRIAL:\n";
  COVENIN_STANDARDS.MECANICA_SEGURIDAD.forEach(s => context += `- ${s.code}: ${s.title}\n`);
  
  return context;
};