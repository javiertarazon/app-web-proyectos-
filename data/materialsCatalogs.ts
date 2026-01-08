export interface CatalogProduct {
  name: string;
  specs: string;
  unit: string;
  estimatedPrice: number;
}

export interface MaterialCatalog {
  name: string;
  url: string;
  description: string;
  products: CatalogProduct[];
}

export const LLS_ELECTRIC_CATALOG: MaterialCatalog = {
  name: "LLS Electric - Catálogo General Media Tensión",
  url: "https://www.llselectric.com/es/",
  description: "Materiales integrales para redes de distribución eléctrica: Cortacircuitos, Pararrayos, Aisladores y Herrajes de Línea.",
  products: [
    // --- CORTACIRCUITOS FUSIBLES (FUSE CUTOUTS) ---
    {
      name: "Cortacircuito Fusible Polimérico 15 kV (Polymer Dropout Fuse Cutout)",
      specs: "Tensión: 15 kV, Corriente: 100/200A, BIL: 110 kV, IC: 10-12 kA. Aislador de goma de silicona hidrofóbica.",
      unit: "Pza",
      estimatedPrice: 95.00
    },
    {
      name: "Cortacircuito Fusible Polimérico 24-27 kV",
      specs: "Tensión: 27 kV, Corriente: 100/200A, BIL: 150 kV. Herrajes galvanizados en caliente.",
      unit: "Pza",
      estimatedPrice: 125.00
    },
    {
      name: "Cortacircuito Fusible Polimérico 33-36 kV",
      specs: "Tensión: 36 kV, Corriente: 100/200A, BIL: 170 kV. Distancia de fuga extendida para contaminación.",
      unit: "Pza",
      estimatedPrice: 160.00
    },
    {
      name: "Cortacircuito Fusible Porcelana 15 kV",
      specs: "Tensión: 15 kV, 100A. Aislador de porcelana vitrificada gris ANSI 70. NEMA bracket incluido.",
      unit: "Pza",
      estimatedPrice: 85.00
    },

    // --- PARARRAYOS (SURGE ARRESTERS) ---
    {
      name: "Pararrayos Polimérico ZnO 10-12 kV (Distribution Surge Arrester)",
      specs: "Clase 1, 10kA descarga nominal. MCOV 10.2kV. Carcasa de silicona, con desconectador de falla a tierra.",
      unit: "Pza",
      estimatedPrice: 65.00
    },
    {
      name: "Pararrayos Polimérico ZnO 21-24 kV",
      specs: "Clase 1, 10kA. MCOV 19.5-24.4kV. Para protección de transformadores y líneas de 24kV.",
      unit: "Pza",
      estimatedPrice: 85.00
    },
    {
      name: "Pararrayos Polimérico ZnO 30-36 kV",
      specs: "Alta tensión, 10kA. MCOV 29kV+. Alta resistencia a UV y tracking.",
      unit: "Pza",
      estimatedPrice: 110.00
    },

    // --- AISLADORES (INSULATORS) ---
    {
      name: "Aislador de Suspensión Polimérico 15 kV (Dead-end Insulator)",
      specs: "Tipo DS-15, Carga mecánica 70kN (SML). Herrajes tipo Ojo-Bola (Ball & Socket) o Clevis-Lengua.",
      unit: "Pza",
      estimatedPrice: 22.00
    },
    {
      name: "Aislador de Suspensión Polimérico 25-35 kV",
      specs: "Tipo DS-28/35, Carga mecánica 70kN/120kN. Longitud 450mm aprox. Para remates y anclajes.",
      unit: "Pza",
      estimatedPrice: 35.00
    },
    {
      name: "Aislador Tipo Pin Polimérico 15 kV (Line Post)",
      specs: "Montaje vertical en espiga de 1 pulgada. Cuello F. Equivalente ANSI 55-4/5.",
      unit: "Pza",
      estimatedPrice: 28.00
    },
    {
      name: "Aislador Tipo Pin Polimérico 24-36 kV",
      specs: "Montaje rígido para cruceta. Alta línea de fuga.",
      unit: "Pza",
      estimatedPrice: 45.00
    },
    {
      name: "Aislador Tipo Carrete (Spool Insulator)",
      specs: "Porcelana ANSI 53-2. Baja tensión y neutros.",
      unit: "Pza",
      estimatedPrice: 5.50
    },

    // --- SECCIONADORES (DISCONNECT SWITCHES) ---
    {
      name: "Seccionador Monopolar 15 kV 600A (Disconnect Switch)",
      specs: "Operación con pértiga (Hook stick). Cuchillas de cobre electrolítico plateado. Base canal C.",
      unit: "Pza",
      estimatedPrice: 180.00
    },
    {
      name: "Seccionador Monopolar 24-36 kV 600A",
      specs: "Operación sin carga. Aisladores poliméricos tipo estación. Bloqueo de seguridad a 90 grados.",
      unit: "Pza",
      estimatedPrice: 250.00
    },

    // --- ACCESORIOS Y HERRAJES ---
    {
      name: "Fusible Link (Eslabón Fusible) Tipo K",
      specs: "Universal (1A a 100A), curva rápida K. Cabeza removible o fija.",
      unit: "Pza",
      estimatedPrice: 4.50
    },
    {
      name: "Portafusible de Repuesto 100A (Fuse Tube)",
      specs: "Tubo de fibra de vidrio con recubrimiento interior apaga-chispas.",
      unit: "Pza",
      estimatedPrice: 25.00
    },
    {
      name: "Grapa de Anclaje Tipo Pistola (Strain Clamp)",
      specs: "Aleación de aluminio para conductores ACSR/AAC 1/0 a 336 MCM. Perno U de acero galvanizado.",
      unit: "Pza",
      estimatedPrice: 15.00
    }
  ]
};

export const getMaterialCatalogsContext = (): string => {
  const catalogs = [LLS_ELECTRIC_CATALOG];
  let context = "CATÁLOGOS DE MATERIALES Y LISTAS DE PRECIOS REFERENCIALES (PRIORIDAD ALTA PARA ESPECIFICACIONES):\n";
  
  catalogs.forEach(cat => {
    context += `\nPROVEEDOR: ${cat.name}\nFUENTE: ${cat.url}\nDESCRIPCIÓN: ${cat.description}\nLISTADO DE PRODUCTOS:\n`;
    cat.products.forEach(p => {
      context += `- MATERIAL: ${p.name} | ESPEC: ${p.specs} | PRECIO REF: $${p.estimatedPrice.toFixed(2)} / ${p.unit}\n`;
    });
  });
  
  return context;
};