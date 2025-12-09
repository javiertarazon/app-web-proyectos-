import { CountryCode, Discipline, Standard } from "../types";

export const SUPPORTED_COUNTRIES: { code: CountryCode; name: string }[] = [
  { code: 'VE', name: 'Venezuela (COVENIN)' },
  { code: 'US', name: 'Estados Unidos (USA)' },
  { code: 'ES', name: 'España (CTE/UNE)' },
  { code: 'MX', name: 'México (NOM)' },
  { code: 'INTL', name: 'Internacional (ISO/IEC)' }
];

export const DISCIPLINES_LIST: { code: Discipline; name: string }[] = [
  { code: 'CIVIL', name: 'Ingeniería Civil' },
  { code: 'ELECTRICA', name: 'Ingeniería Eléctrica' },
  { code: 'MECANICA', name: 'Ingeniería Mecánica' },
  { code: 'SISTEMAS', name: 'Sistemas e Informática' },
  { code: 'TELECOM', name: 'Telecomunicaciones' }
];

type StandardsDB = Record<CountryCode, Record<Discipline, Standard[]>>;

export const STANDARDS_DB: StandardsDB = {
  VE: {
    CIVIL: [
      { code: "COVENIN 1756-1:2019", title: "Edificaciones Sismorresistentes", active: true },
      { code: "COVENIN 1753:2006", title: "Obras en Concreto Estructural", active: true },
      { code: "COVENIN 2000:1987", title: "Mediciones y Codificación de Partidas", active: true },
      { code: "COVENIN 1618:1998", title: "Estructuras de Acero", active: false }
    ],
    ELECTRICA: [
      { code: "COVENIN 200:2009", title: "Código Eléctrico Nacional", active: true },
      { code: "COVENIN 540:2004", title: "Puesta a Tierra", active: true },
      { code: "COVENIN 1568:2005", title: "Tableros de Baja Tensión", active: false }
    ],
    MECANICA: [
      { code: "COVENIN 253:1999", title: "Identificación de Tuberías", active: true },
      { code: "COVENIN 823:2002", title: "Sistemas de Detección de Incendios", active: true }
    ],
    SISTEMAS: [
      { code: "COVENIN 2743:1990", title: "Centros de Procesamiento de Datos", active: true },
      { code: "LDT", title: "Ley de Delitos Informáticos", active: false }
    ],
    TELECOM: [
      { code: "CONATEL", title: "Reglamentos de Habilitaciones", active: true },
      { code: "COVENIN 3368", title: "Cableado Estructurado", active: true }
    ]
  },
  US: {
    CIVIL: [
      { code: "ACI 318-19", title: "Building Code Requirements for Structural Concrete", active: true },
      { code: "ASCE 7-22", title: "Minimum Design Loads", active: true },
      { code: "IBC 2021", title: "International Building Code", active: true }
    ],
    ELECTRICA: [
      { code: "NFPA 70", title: "National Electrical Code (NEC)", active: true },
      { code: "IEEE 142", title: "Grounding of Industrial Systems", active: true }
    ],
    MECANICA: [
      { code: "ASME B31.3", title: "Process Piping", active: true },
      { code: "ASHRAE 90.1", title: "Energy Standard for Buildings", active: false }
    ],
    SISTEMAS: [
      { code: "NIST SP 800-53", title: "Security and Privacy Controls", active: true },
      { code: "IEEE 830", title: "Software Requirements Specifications", active: false }
    ],
    TELECOM: [
      { code: "TIA-568", title: "Commercial Building Telecommunications Cabling", active: true },
      { code: "TIA-607", title: "Grounding and Bonding for Telecom", active: true }
    ]
  },
  ES: {
    CIVIL: [
      { code: "CTE DB-SE", title: "Seguridad Estructural", active: true },
      { code: "EHE-08", title: "Instrucción de Hormigón Estructural", active: true }
    ],
    ELECTRICA: [
      { code: "REBT", title: "Reglamento Electrotécnico Baja Tensión", active: true },
      { code: "UNE 20460", title: "Instalaciones Eléctricas en Edificios", active: false }
    ],
    MECANICA: [
      { code: "RITE", title: "Reglamento Instalaciones Térmicas Edificios", active: true },
      { code: "CTE DB-SI", title: "Seguridad en caso de Incendio", active: true }
    ],
    SISTEMAS: [
      { code: "ENS", title: "Esquema Nacional de Seguridad", active: true },
      { code: "LOPD", title: "Ley Protección de Datos", active: false }
    ],
    TELECOM: [
      { code: "ICT", title: "Infraestructuras Comunes de Telecomunicaciones", active: true },
      { code: "UNE 50173", title: "Tecnología de la Información", active: false }
    ]
  },
  MX: {
    CIVIL: [
      { code: "NTC-CDMX", title: "Normas Técnicas Complementarias CDMX", active: true },
      { code: "NOM-002-STPS", title: "Prevención contra Incendios", active: false }
    ],
    ELECTRICA: [
      { code: "NOM-001-SEDE-2012", title: "Instalaciones Eléctricas (Utilización)", active: true },
      { code: "CFE L0000", title: "Especificaciones CFE", active: true }
    ],
    MECANICA: [
      { code: "NOM-020-STPS", title: "Recipientes Sujetos a Presión", active: true }
    ],
    SISTEMAS: [
      { code: "NOM-151-SCFI", title: "Prácticas Comerciales (Documentos Digitales)", active: true }
    ],
    TELECOM: [
      { code: "NOM-184-SCFI", title: "Servicios de Telecomunicaciones", active: true }
    ]
  },
  INTL: {
    CIVIL: [
      { code: "Eurocode 2", title: "Design of Concrete Structures", active: true }
    ],
    ELECTRICA: [
      { code: "IEC 60364", title: "Low-voltage Electrical Installations", active: true }
    ],
    MECANICA: [
      { code: "ISO 12100", title: "Safety of Machinery", active: true }
    ],
    SISTEMAS: [
      { code: "ISO/IEC 27001", title: "Information Security Management", active: true },
      { code: "ISO/IEC 12207", title: "Software Life Cycle Processes", active: true }
    ],
    TELECOM: [
      { code: "ITU-T Series", title: "Standardization Sector", active: true }
    ]
  }
};
