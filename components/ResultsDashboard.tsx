import React, { useState, useEffect, useRef } from 'react';
import { ProjectResponse, Partida, APUItem, PresupuestoConfig, APU } from '../types';
import CalculationCard from './CalculationCard';
import { saveProject } from '../services/storageService';
import * as XLSX from 'xlsx'; // Import XLSX library
import { 
  FileText, 
  Calculator, 
  DollarSign, 
  Layers,
  Search,
  MapPin,
  Briefcase,
  Scale,
  ListOrdered,
  Zap,
  MessageSquareMore,
  X,
  Send,
  Loader2,
  Edit,
  Save,
  FileType,
  FileSpreadsheet,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Filter,
  Droplets,
  Ruler,
  Thermometer,
  Check,
  Download,
  BookOpen,
  StopCircle,
  PackageCheck,
  Hammer
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ResultsDashboardProps {
  data: ProjectResponse;
  onModify: (request: string) => Promise<void>; // Function to call parent modification logic
  onCancelModify: () => void; // Function to cancel modification
  isModifying: boolean;
}

// Helper to download text as file
const downloadFile = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

type SortKey = 'codigo' | 'descripcion' | 'metrado' | 'precioUnitario' | 'precioTotal';
type SortDirection = 'asc' | 'desc';

const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ data: initialData, onModify, onCancelModify, isModifying }) => {
  const [data, setData] = useState<ProjectResponse>(initialData);
  const [activeTab, setActiveTab] = useState<'memoria' | 'calculos' | 'presupuesto' | 'apu'>('memoria');
  const [expandedApuIndex, setExpandedApuIndex] = useState<number | null>(0);
  const [expandedBudgetRow, setExpandedBudgetRow] = useState<string | null>(null); // State for budget table expansion
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [apuSearchTerm, setApuSearchTerm] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Budget Table Filter & Sort
  const [budgetSearchTerm, setBudgetSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{key: SortKey, direction: SortDirection}>({ key: 'codigo', direction: 'asc' });

  // Chat Modification State
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync state if initialData changes
  useEffect(() => {
    // Data normalization logic (retained from previous)
    const normalizedData = {
        ...initialData,
        presupuesto: initialData.presupuesto.map(p => ({
            ...p,
            factorAjuste: p.factorAjuste ?? 0,
            apu: {
                ...p.apu,
                laborCASPorcentaje: p.apu.laborCASPorcentaje ?? 200, 
                laborCestaTicket: p.apu.laborCestaTicket ?? 5,
                rendimiento: p.apu.rendimiento || 1,
                rendimientoUnidad: p.apu.rendimientoUnidad || `${p.unidad}/dia`,
                materiales: p.apu.materiales.map(m => ({...m, desperdicio: m.desperdicio ?? 0}))
            }
        }))
    };
    setData(normalizedData);
  }, [initialData]);

  const handleSaveProject = () => {
    setIsSaving(true);
    try {
        const saved = saveProject(data);
        setData(saved); // Update state with ID
        setTimeout(() => setIsSaving(false), 1000);
    } catch (e) {
        alert("Error guardando proyecto.");
        setIsSaving(false);
    }
  };

  const handleModificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && !isModifying) {
      // Scroll to bottom
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      await onModify(chatInput);
      setChatInput('');
    }
  };

  // --- LÓGICA DE CÁLCULO APU ---
  const recalculatePartida = (partida: Partida): Partida => {
    const calculateMaterialTotal = (item: APUItem) => {
        const wasteFactor = 1 + ((item.desperdicio || 0) / 100);
        return item.cantidad * item.costoUnitario * wasteFactor;
    };
    const totalMateriales = partida.apu.materiales.reduce((acc, item) => acc + calculateMaterialTotal(item), 0);
    const calculateSimpleTotal = (item: APUItem) => item.cantidad * item.costoUnitario;
    const totalEquipos = partida.apu.equipos.reduce((acc, item) => acc + calculateSimpleTotal(item), 0);
    
    // Cálculo Mano de Obra estilo Lulo (Base + CAS + Bono)
    const totalLaborBase = partida.apu.manoDeObra.reduce((acc, item) => acc + calculateSimpleTotal(item), 0);
    const montoCAS = totalLaborBase * (partida.apu.laborCASPorcentaje / 100);
    const totalHombresDia = partida.apu.manoDeObra.reduce((acc, item) => acc + item.cantidad, 0);
    const montoBono = totalHombresDia * partida.apu.laborCestaTicket;
    const totalManoDeObra = totalLaborBase + montoCAS + montoBono;

    const costoDirecto = totalMateriales + totalEquipos + totalManoDeObra;
    const adminMonto = costoDirecto * (partida.apu.administracionPorcentaje / 100);
    const subtotalB = costoDirecto + adminMonto;
    const utilidadMonto = subtotalB * (partida.apu.utilidadPorcentaje / 100);
    const precioUnitarioPrevio = subtotalB + utilidadMonto;
    const ajusteMonto = precioUnitarioPrevio * ((partida.factorAjuste || 0) / 100);
    const nuevoPrecioUnitario = precioUnitarioPrevio + ajusteMonto;

    return {
      ...partida,
      precioUnitario: nuevoPrecioUnitario,
      precioTotal: nuevoPrecioUnitario * partida.metrado,
      apu: {
        ...partida.apu,
        materiales: partida.apu.materiales.map(i => ({...i, total: calculateMaterialTotal(i)})),
        equipos: partida.apu.equipos.map(i => ({...i, total: calculateSimpleTotal(i)})),
        manoDeObra: partida.apu.manoDeObra.map(i => ({...i, total: calculateSimpleTotal(i)})),
      }
    };
  };

  const handleBudgetChange = (index: number, field: keyof Partida, value: string | number) => {
    const newData = { ...data };
    let partida = { ...newData.presupuesto[index] };
    if (field === 'metrado') {
      partida.metrado = Number(value);
      partida.precioTotal = partida.metrado * partida.precioUnitario;
    } else {
      (partida as any)[field] = value;
    }
    newData.presupuesto[index] = partida;
    setData(newData);
  };

  const handleAdjustmentFactorChange = (index: number, value: string) => {
    const newData = { ...data };
    let partida = { ...newData.presupuesto[index] };
    partida.factorAjuste = Number(value);
    newData.presupuesto[index] = recalculatePartida(partida);
    setData(newData);
  };

  const handleAPUGlobalChange = (index: number, field: keyof APU, value: string, type: 'number' | 'string' = 'number') => {
      const newData = { ...data };
      let partida = { ...newData.presupuesto[index] };
      // @ts-ignore
      partida.apu[field] = type === 'number' ? Number(value) : value;
      newData.presupuesto[index] = recalculatePartida(partida);
      setData(newData);
  };

  const handleAPUItemChange = (partidaIndex: number, category: 'materiales' | 'equipos' | 'manoDeObra', itemIndex: number, field: keyof APUItem, value: string | number) => {
    const newData = { ...data };
    const partida = { ...newData.presupuesto[partidaIndex] };
    const items = [...partida.apu[category]];
    const item = { ...items[itemIndex] };
    (item as any)[field] = field === 'descripcion' || field === 'unidad' ? value : Number(value);
    items[itemIndex] = item;
    partida.apu = { ...partida.apu, [category]: items };
    newData.presupuesto[partidaIndex] = recalculatePartida(partida);
    setData(newData);
  };

  const handleConfigChange = (field: keyof PresupuestoConfig, value: string) => {
    setData(prev => ({
        ...prev,
        presupuestoConfig: {
            ...prev.presupuestoConfig,
            [field]: Number(value)
        }
    }));
  };

  // --- Sorting & Filtering Logic for Budget Table ---
  const handleSort = (key: SortKey) => {
      setSortConfig(prev => ({
          key,
          direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const getSortedAndFilteredBudget = () => {
      // 1. Filter
      let filtered = data.presupuesto.map((p, idx) => ({ ...p, originalIndex: idx })); // Keep track of original index for handlers
      
      if (budgetSearchTerm) {
          const lowerTerm = budgetSearchTerm.toLowerCase();
          filtered = filtered.filter(p => 
              p.codigo.toLowerCase().includes(lowerTerm) || 
              p.descripcion.toLowerCase().includes(lowerTerm)
          );
      }

      // 2. Sort
      filtered.sort((a, b) => {
          let aValue = a[sortConfig.key];
          let bValue = b[sortConfig.key];

          if (typeof aValue === 'string') aValue = aValue.toLowerCase();
          if (typeof bValue === 'string') bValue = bValue.toLowerCase();

          if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });

      return filtered;
  };

  const sortedBudget = getSortedAndFilteredBudget();

  // --- EXPORT FUNCTIONS (UPDATED TO EXCEL) ---
  
  const downloadMemoriaMarkdown = () => {
    let md = `# ${data.projectTitle}\n\n`;
    md += `**Disciplina:** ${data.discipline}\n`;
    md += `**Fecha:** ${new Date().toLocaleDateString()}\n`;
    md += `**Responsable:** ${data.memoriaDescriptiva.informacionEmpresa.nombreIngeniero}\n\n`;
    md += `## 1. MEMORIA DESCRIPTIVA\n\n`;
    md += `### 1.1 Introducción\n${data.memoriaDescriptiva.introduccion}\n\n`;
    md += `### 1.2 Descripción del Predio\n${data.memoriaDescriptiva.descripcionPredio}\n\n`;
    md += `### 1.3 Descripción del Proyecto\n${data.memoriaDescriptiva.descripcionProyecto}\n\n`;
    md += `### 1.4 Marco Legal\n${data.memoriaDescriptiva.marcoLegal.map(m => `- ${m}`).join('\n')}\n\n`;
    md += `### 1.5 Conclusiones\n${data.memoriaDescriptiva.conclusiones}\n\n`;
    downloadFile(md, `Memoria_Descriptiva_${data.projectTitle.replace(/\s+/g, '_')}.md`, 'text/markdown');
    setShowExportMenu(false);
  };

  const downloadCalculationMemory = () => {
    let txt = `MEMORIA DE CÁLCULO DETALLADA\n`;
    txt += `PROYECTO: ${data.projectTitle}\n`;
    txt += `=================================================\n\n`;
    
    txt += `1. RESUMEN DE VARIABLES CRÍTICAS\n`;
    data.memoriaCalculo.forEach(item => {
        txt += `- ${item.name}: ${item.value} ${item.unit} (${item.description})\n`;
    });
    
    txt += `\n2. DESARROLLO MATEMÁTICO POR DISCIPLINA\n`;
    txt += `-------------------------------------------------\n`;
    txt += `2.1 CÁLCULOS ESTRUCTURALES Y CÓMPUTOS MÉTRICOS\n`;
    txt += `${data.memoriaDescriptiva.calculosEstructuralesDetallados || 'No aplica'}\n\n`;
    
    txt += `2.2 CÁLCULOS ELÉCTRICOS (ESTUDIO DE CARGAS)\n`;
    txt += `${data.memoriaDescriptiva.calculosElectricosDetallados || 'No aplica'}\n\n`;
    
    txt += `2.3 CÁLCULOS SANITARIOS\n`;
    txt += `${data.memoriaDescriptiva.calculosSanitariosDetallados || 'No aplica'}\n\n`;
    
    txt += `2.4 CÁLCULOS MECÁNICOS\n`;
    txt += `${data.memoriaDescriptiva.calculosMecanicosDetallados || 'No aplica'}\n\n`;
    
    downloadFile(txt, `Memoria_Calculo_${data.projectTitle.replace(/\s+/g, '_')}.txt`, 'text/plain');
    setShowExportMenu(false);
  };

  // --- EXCEL EXPORT FUNCTIONS (IMPROVED) ---

  const downloadBudgetExcel = () => {
    const totalPresupuesto = data.presupuesto.reduce((acc, item) => acc + item.precioTotal, 0);
    const montoIVA = totalPresupuesto * (data.presupuestoConfig.porcentajeIVA / 100);
    const totalGeneral = totalPresupuesto + montoIVA;

    const rows: any[][] = [];
    
    // Header Info (Merged look)
    rows.push(["PRESUPUESTO DE OBRA"]);
    rows.push([`PROYECTO: ${data.projectTitle}`]);
    rows.push([`DISCIPLINA: ${data.discipline}`]);
    rows.push([`FECHA: ${new Date().toLocaleDateString()}`]);
    rows.push([]); 

    // Table Header
    rows.push(["Nº", "CÓDIGO", "DESCRIPCIÓN DE LA PARTIDA", "UNIDAD", "CANTIDAD", "P. UNITARIO", "TOTAL"]);

    // Items
    data.presupuesto.forEach((p, idx) => {
        rows.push([
            idx + 1,
            p.codigo,
            p.descripcion,
            p.unidad,
            { v: p.metrado, t: 'n' }, // Force number type for Excel formulas
            { v: p.precioUnitario, t: 'n', z: '#,##0.00' }, // Currency format
            { v: p.precioTotal, t: 'n', z: '#,##0.00' }
        ]);
    });

    // Footer
    rows.push([]);
    rows.push(["", "", "", "", "", "SUBTOTAL:", { v: totalPresupuesto, t: 'n', z: '#,##0.00' }]);
    rows.push(["", "", "", "", "", `IVA (${data.presupuestoConfig.porcentajeIVA}%):`, { v: montoIVA, t: 'n', z: '#,##0.00' }]);
    rows.push(["", "", "", "", "", "TOTAL GENERAL:", { v: totalGeneral, t: 'n', z: '#,##0.00' }]);

    // Create Sheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set Column Widths (Aesthetically pleasing)
    ws['!cols'] = [
        { wch: 5 },  // No
        { wch: 15 }, // Codigo
        { wch: 70 }, // Descripcion
        { wch: 10 }, // Unidad
        { wch: 15 }, // Cantidad
        { wch: 20 }, // PU
        { wch: 20 }  // Total
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presupuesto General");
    XLSX.writeFile(wb, `Presupuesto_${data.projectTitle.replace(/\s+/g, '_')}.xlsx`);
    setShowExportMenu(false);
  };

  const downloadMaterialsExcel = () => {
    // This function creates a Bill of Materials (BOM) report
    const wb = XLSX.utils.book_new();
    
    // SHEET 1: Detailed Breakdown Per Partida
    const detailedRows: any[][] = [];
    detailedRows.push(["DESGLOSE DETALLADO DE MATERIALES POR PARTIDA"]);
    detailedRows.push([`PROYECTO: ${data.projectTitle}`]);
    detailedRows.push([]);
    detailedRows.push(["CÓD. PARTIDA", "DESCRIPCIÓN PARTIDA", "MATERIAL (INSUMO)", "UNIDAD", "CANTIDAD (UNIT)", "DESPERDICIO %", "PRECIO UNITARIO", "SUBTOTAL MATERIAL (Por Unidad de Partida)"]);

    data.presupuesto.forEach((p) => {
      // Row for the Partida (Merged style header within table)
      // We will list materials below
      if (p.apu.materiales.length > 0) {
        let totalMaterialPartida = 0;
        p.apu.materiales.forEach((m) => {
          const wasteFactor = 1 + ((m.desperdicio || 0) / 100);
          const subtotalMat = m.cantidad * m.costoUnitario * wasteFactor;
          totalMaterialPartida += subtotalMat;

          detailedRows.push([
            p.codigo,
            p.descripcion,
            m.descripcion,
            m.unidad,
            { v: m.cantidad, t: 'n' },
            { v: m.desperdicio || 0, t: 'n' },
            { v: m.costoUnitario, t: 'n', z: '#,##0.00' },
            { v: subtotalMat, t: 'n', z: '#,##0.00' }
          ]);
        });
        // Optional: Add a summary line for the partida materials? 
        // For raw data export, it's often better to keep it flat, but user asked for "sumatory per partida"
        detailedRows.push(["", "", "TOTAL MATERIALES PARTIDA " + p.codigo, "", "", "", "", { v: totalMaterialPartida, t: 'n', z: '#,##0.00', s: { font: { bold: true } } }]);
        detailedRows.push([]); // Spacer
      }
    });

    const wsDetailed = XLSX.utils.aoa_to_sheet(detailedRows);
    wsDetailed['!cols'] = [{ wch: 15 }, { wch: 50 }, { wch: 40 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsDetailed, "Desglose por Partida");

    // SHEET 2: Consolidated Global Materials (Shopping List)
    const consolidatedRows: any[][] = [];
    consolidatedRows.push(["LISTADO CONSOLIDADO DE COMPRA (INSUMOS TOTALES)"]);
    consolidatedRows.push([`PROYECTO: ${data.projectTitle}`]);
    consolidatedRows.push([]);
    consolidatedRows.push(["DESCRIPCIÓN MATERIAL", "UNIDAD", "CANTIDAD TOTAL REQUERIDA", "COSTO ESTIMADO TOTAL"]);

    const materialsMap = new Map<string, { unit: string, qty: number, cost: number }>();

    data.presupuesto.forEach(p => {
       const partidaQty = p.metrado;
       p.apu.materiales.forEach(m => {
          // Normalize name to aggregate correctly
          const key = m.descripcion.trim().toLowerCase();
          const wasteFactor = 1 + ((m.desperdicio || 0) / 100);
          const unitQty = m.cantidad * wasteFactor;
          const totalQtyForPartida = unitQty * partidaQty;
          const totalCostForPartida = totalQtyForPartida * m.costoUnitario;

          if (materialsMap.has(key)) {
             const existing = materialsMap.get(key)!;
             existing.qty += totalQtyForPartida;
             existing.cost += totalCostForPartida;
          } else {
             materialsMap.set(key, { unit: m.unidad, qty: totalQtyForPartida, cost: totalCostForPartida });
          }
       });
    });

    // Convert map to array and sort
    const consolidatedList = Array.from(materialsMap.entries()).map(([name, data]) => ({
       name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize
       ...data
    })).sort((a,b) => a.name.localeCompare(b.name));

    consolidatedList.forEach(item => {
       consolidatedRows.push([
         item.name,
         item.unit,
         { v: item.qty, t: 'n', z: '#,##0.00' },
         { v: item.cost, t: 'n', z: '#,##0.00' }
       ]);
    });
    
    // Total Material Cost
    const totalMaterialCost = consolidatedList.reduce((acc, item) => acc + item.cost, 0);
    consolidatedRows.push(["", "", "TOTAL GENERAL INSUMOS", { v: totalMaterialCost, t: 'n', z: '#,##0.00' }]);

    const wsConsolidated = XLSX.utils.aoa_to_sheet(consolidatedRows);
    wsConsolidated['!cols'] = [{ wch: 60 }, { wch: 10 }, { wch: 25 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsConsolidated, "Insumos Consolidados");

    XLSX.writeFile(wb, `Listado_Materiales_${data.projectTitle.replace(/\s+/g, '_')}.xlsx`);
    setShowExportMenu(false);
  };

  const downloadAPUExcel = () => {
    const wb = XLSX.utils.book_new();

    data.presupuesto.forEach(p => {
        const rows: any[][] = [];
        
        // --- Header Partida ---
        rows.push(["ANÁLISIS DE PRECIO UNITARIO"]);
        rows.push(["OBRA:", data.projectTitle]);
        rows.push(["PARTIDA:", p.codigo, "FECHA:", new Date().toLocaleDateString()]);
        rows.push(["DESCRIPCIÓN:", p.descripcion]);
        rows.push(["UNIDAD:", p.unidad, "CANTIDAD:", { v: p.metrado, t: 'n' }]);
        rows.push(["RENDIMIENTO:", { v: p.apu.rendimiento, t: 'n' }, p.apu.rendimientoUnidad]);
        rows.push([]); // Spacer
        
        // --- 1. Materiales ---
        rows.push(["1. MATERIALES"]);
        rows.push(["Descripción", "Unidad", "Cantidad", "% Desp.", "Costo Unit.", "Total"]);
        
        p.apu.materiales.forEach(m => {
            rows.push([
              m.descripcion, 
              m.unidad, 
              { v: m.cantidad, t: 'n' }, 
              { v: m.desperdicio, t: 'n' }, 
              { v: m.costoUnitario, t: 'n', z: '#,##0.00' }, 
              { v: m.total, t: 'n', z: '#,##0.00' }
            ]);
        });
        
        const totalMat = p.apu.materiales.reduce((a,b)=>a+b.total,0);
        rows.push(["", "", "", "", "TOTAL MATERIALES:", { v: totalMat, t: 'n', z: '#,##0.00' }]);
        rows.push([]);

        // --- 2. Equipos ---
        rows.push(["2. EQUIPOS"]);
        rows.push(["Descripción", "", "Cantidad", "Costo/Día", "", "Total"]); 
        
        p.apu.equipos.forEach(m => {
            rows.push([
              m.descripcion, 
              "", 
              { v: m.cantidad, t: 'n' }, 
              { v: m.costoUnitario, t: 'n', z: '#,##0.00' }, 
              "", 
              { v: m.total, t: 'n', z: '#,##0.00' }
            ]);
        });
        
        const totalEq = p.apu.equipos.reduce((a,b)=>a+b.total,0);
        rows.push(["", "", "", "", "TOTAL EQUIPOS:", { v: totalEq, t: 'n', z: '#,##0.00' }]);
        rows.push([]);

        // --- 3. Mano de Obra ---
        rows.push(["3. MANO DE OBRA"]);
        rows.push(["Descripción", "", "Cantidad", "Jornal", "", "Total"]);
        
        p.apu.manoDeObra.forEach(m => {
            rows.push([
              m.descripcion, 
              "", 
              { v: m.cantidad, t: 'n' }, 
              { v: m.costoUnitario, t: 'n', z: '#,##0.00' }, 
              "", 
              { v: m.total, t: 'n', z: '#,##0.00' }
            ]);
        });
        
        // Calculate Labor Totals Lulo Style
        const subtotalLaborBase = p.apu.manoDeObra.reduce((a,b)=>a+b.total,0);
        const montoCAS = subtotalLaborBase * (p.apu.laborCASPorcentaje/100);
        const totalHombresDia = p.apu.manoDeObra.reduce((a,b)=>a+b.cantidad,0);
        const montoBono = totalHombresDia * p.apu.laborCestaTicket;
        const totalManoDeObra = subtotalLaborBase + montoCAS + montoBono;

        rows.push(["", "", "", "", "Subtotal Salarios:", { v: subtotalLaborBase, t: 'n', z: '#,##0.00' }]);
        rows.push(["", "", "", "", `Prestaciones Sociales (${p.apu.laborCASPorcentaje}%):`, { v: montoCAS, t: 'n', z: '#,##0.00' }]);
        rows.push(["", "", "", "", "Bono Alimentación (Cesta Ticket):", { v: montoBono, t: 'n', z: '#,##0.00' }]);
        // This is the line that sums up previous 3
        rows.push(["", "", "", "", "TOTAL MANO DE OBRA:", { v: totalManoDeObra, t: 'n', z: '#,##0.00' }]); 
        rows.push([]);

        // --- Resumen ---
        const costoDirecto = totalMat + totalEq + totalManoDeObra;
        const admin = costoDirecto * (p.apu.administracionPorcentaje/100);
        const subtotal = costoDirecto + admin;
        const utilidad = subtotal * (p.apu.utilidadPorcentaje/100);
        
        rows.push(["RESUMEN DE COSTOS"]);
        rows.push(["Concepto", "", "", "", "", "Monto"]);
        rows.push(["A. TOTAL MATERIALES", "", "", "", "", { v: totalMat, t: 'n', z: '#,##0.00' }]);
        rows.push(["B. TOTAL EQUIPOS", "", "", "", "", { v: totalEq, t: 'n', z: '#,##0.00' }]);
        rows.push(["C. TOTAL MANO DE OBRA", "", "", "", "", { v: totalManoDeObra, t: 'n', z: '#,##0.00' }]);
        
        rows.push(["COSTO DIRECTO (A+B+C)", "", "", "", "", { v: costoDirecto, t: 'n', z: '#,##0.00' }]);
        rows.push([`ADMINISTRACIÓN Y GASTOS (${p.apu.administracionPorcentaje}%)`, "", "", "", "", { v: admin, t: 'n', z: '#,##0.00' }]);
        rows.push(["SUBTOTAL", "", "", "", "", { v: subtotal, t: 'n', z: '#,##0.00' }]);
        rows.push([`UTILIDAD E IMPREVISTOS (${p.apu.utilidadPorcentaje}%)`, "", "", "", "", { v: utilidad, t: 'n', z: '#,##0.00' }]);
        
        let precioPrevio = subtotal + utilidad;
        if (p.factorAjuste) {
             const ajuste = precioPrevio * (p.factorAjuste/100);
             rows.push([`FACTOR DE AJUSTE (${p.factorAjuste}%)`, "", "", "", "", { v: ajuste, t: 'n', z: '#,##0.00' }]);
             precioPrevio += ajuste;
        }

        rows.push(["PRECIO UNITARIO FINAL", "", "", "", "", { v: p.precioUnitario, t: 'n', z: '#,##0.00' }]);

        // Create the sheet for this APU
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Styling Columns
        ws['!cols'] = [
            { wch: 45 }, // A: Description
            { wch: 8 },  // B: Unit
            { wch: 10 }, // C: Qty
            { wch: 10 }, // D: Rate
            { wch: 15 }, // E: Unit Cost (Label)
            { wch: 15 }  // F: Total Cost
        ];

        // Sheet Name Sanitization
        let safeName = p.codigo.replace(/[:\/\\?*\[\]]/g, "_").substring(0, 30);
        if (!safeName) safeName = `Partida_${Math.floor(Math.random()*1000)}`;

        try {
            XLSX.utils.book_append_sheet(wb, ws, safeName);
        } catch (e) {
            XLSX.utils.book_append_sheet(wb, ws, `${safeName}_${Math.floor(Math.random()*100)}`);
        }
    });

    XLSX.writeFile(wb, `APUs_${data.projectTitle.replace(/\s+/g, '_')}.xlsx`);
    setShowExportMenu(false);
  };

  const totalPresupuesto = data.presupuesto.reduce((acc, item) => acc + item.precioTotal, 0);
  const montoIVA = totalPresupuesto * (data.presupuestoConfig.porcentajeIVA / 100);
  const totalGeneral = totalPresupuesto + montoIVA;
  const montoAnticipo = totalGeneral * (data.presupuestoConfig.porcentajeAnticipo / 100);

  const costDistribution = [
    { name: 'Materiales', value: data.presupuesto.reduce((acc, p) => acc + (p.apu.materiales.reduce((s, m) => s + m.total, 0) * p.metrado), 0) },
    { name: 'Mano de Obra', value: data.presupuesto.reduce((acc, p) => acc + (p.apu.manoDeObra.reduce((s, m) => s + m.total, 0) * p.metrado), 0) },
    { name: 'Equipos', value: data.presupuesto.reduce((acc, p) => acc + (p.apu.equipos.reduce((s, m) => s + m.total, 0) * p.metrado), 0) },
  ];
  const COLORS = ['#0ea5e9', '#f59e0b', '#10b981'];

  const filteredAPUs = data.presupuesto.map((p, index) => ({ partida: p, index })).filter(item => 
    item.partida.descripcion.toLowerCase().includes(apuSearchTerm.toLowerCase()) || 
    item.partida.codigo.toLowerCase().includes(apuSearchTerm.toLowerCase())
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in pb-20 relative">
      
      {/* Modification Chat Panel - Floating */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${showChat ? 'w-96' : 'w-auto'}`}>
         {!showChat && (
            <button 
              onClick={() => setShowChat(true)}
              className="bg-eng-600 hover:bg-eng-500 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 animate-bounce-subtle"
            >
                <MessageSquareMore className="w-6 h-6" />
                <span className="font-bold pr-2">Asistente de Cambios</span>
            </button>
         )}

         {showChat && (
             <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col h-[500px]">
                 <div className="bg-eng-900/50 p-3 border-b border-slate-700 flex justify-between items-center">
                     <div className="flex items-center gap-2">
                        <MessageSquareMore className="w-4 h-4 text-eng-400" />
                        <h3 className="font-bold text-sm text-white">Solicitar Cambios</h3>
                     </div>
                     <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4"/></button>
                 </div>
                 
                 <div className="flex-grow p-4 overflow-y-auto bg-slate-950/80 text-sm text-slate-300 flex flex-col">
                     <p className="mb-4">Describe los cambios que deseas realizar. La IA actualizará el proyecto completo.</p>
                     
                     {/* Suggestion Box */}
                     {!isModifying && (
                        <div className="bg-slate-800 p-3 rounded-lg mb-2 border border-slate-700">
                            <span className="font-bold text-xs text-eng-400 block mb-1">Ejemplos:</span>
                            <ul className="list-disc pl-4 space-y-1 text-xs text-slate-400">
                                <li>"Desglosa mejor las partidas eléctricas"</li>
                                <li>"Agrega cálculo detallado para el tanque de agua"</li>
                                <li>"Cambia el rendimiento del concreto a 20 m3/día"</li>
                                <li>"Detalla más los materiales de las partidas de plomería (pega, codos, etc.)"</li>
                            </ul>
                        </div>
                     )}

                     {isModifying && (
                        <div className="flex flex-col items-center justify-center flex-grow py-4 space-y-4">
                            <div className="flex items-center gap-2 text-eng-400">
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <span className="font-bold">Procesando cambios...</span>
                            </div>
                            <p className="text-xs text-slate-500 text-center px-4">Recalculando APUs, Metrados y Memorias.</p>
                            
                            {/* STOP BUTTON */}
                            <button 
                                onClick={onCancelModify}
                                className="mt-4 bg-red-900/50 hover:bg-red-800 text-red-200 px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors border border-red-800"
                            >
                                <StopCircle className="w-4 h-4" />
                                Detener
                            </button>
                        </div>
                     )}
                     <div ref={chatEndRef}></div>
                 </div>

                 <form onSubmit={handleModificationSubmit} className="p-3 bg-slate-800 border-t border-slate-700">
                    <div className="relative">
                        <textarea 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Escribe tu solicitud..."
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 pl-3 pr-10 text-xs text-white resize-none focus:ring-1 focus:ring-eng-500 outline-none disabled:opacity-50"
                            rows={2}
                            disabled={isModifying}
                            onKeyDown={(e) => {
                                if(e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleModificationSubmit(e);
                                }
                            }}
                        />
                        <button 
                            type="submit" 
                            disabled={!chatInput.trim() || isModifying}
                            className="absolute right-2 bottom-2 text-eng-500 hover:text-eng-400 disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                 </form>
             </div>
         )}
      </div>

      {/* Header & Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 pb-4 mb-2 sticky top-[4rem] z-40 pt-4 -mt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-eng-500 font-mono text-xs uppercase tracking-widest border border-eng-900 bg-eng-950 px-2 py-0.5 rounded">
                {data.discipline}
              </span>
              {data.lastModified && (
                  <span className="text-[10px] text-slate-500">
                      Guardado: {new Date(data.lastModified).toLocaleString()}
                  </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                {data.projectTitle}
                <button 
                    onClick={handleSaveProject} 
                    className="p-1 hover:bg-slate-800 rounded-full transition-colors" 
                    title="Guardar Proyecto"
                >
                    {isSaving ? <Loader2 className="w-5 h-5 text-eng-400 animate-spin" /> : <Save className="w-5 h-5 text-slate-400 hover:text-eng-400" />}
                </button>
            </h1>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-lg">
             <button 
               onClick={() => setIsEditing(!isEditing)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${isEditing ? 'bg-eng-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
             >
               {isEditing ? <Save className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
               {isEditing ? 'Terminar Edición' : 'Editar Datos'}
             </button>
             <div className="w-px h-6 bg-slate-700 mx-1"></div>
             
             {/* EXPORT MENU */}
             <div className="relative">
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${showExportMenu ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                >
                  <Download className="w-4 h-4" />
                  Exportar
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50 overflow-hidden animate-fade-in-up">
                      <div className="p-2 border-b border-slate-700 text-[10px] uppercase text-slate-500 font-bold tracking-wider px-3">
                        Selecciona Formato
                      </div>
                      <button onClick={downloadMemoriaMarkdown} className="w-full text-left px-4 py-3 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-400" /> Memoria Descriptiva (MD)
                      </button>
                      <button onClick={downloadCalculationMemory} className="w-full text-left px-4 py-3 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-orange-400" /> Memoria de Cálculo (TXT)
                      </button>
                      <button onClick={downloadBudgetExcel} className="w-full text-left px-4 py-3 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-green-400" /> Presupuesto (Excel)
                      </button>
                      <button onClick={downloadMaterialsExcel} className="w-full text-left px-4 py-3 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-2">
                          <PackageCheck className="w-4 h-4 text-yellow-400" /> Listado Materiales (Excel)
                      </button>
                      <button onClick={downloadAPUExcel} className="w-full text-left px-4 py-3 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-2 border-t border-slate-700 bg-slate-750">
                          <BookOpen className="w-4 h-4 text-purple-400" /> Libro de APUs (Excel)
                      </button>
                  </div>
                )}
             </div>
          </div>
        </div>

        <div className="flex border-b border-slate-700 space-x-1 overflow-x-auto">
          <button onClick={() => setActiveTab('memoria')} className={`px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'memoria' ? 'border-eng-500 text-eng-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}>
            <FileText className="w-4 h-4" /> Memoria
          </button>
          <button onClick={() => setActiveTab('calculos')} className={`px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'calculos' ? 'border-eng-500 text-eng-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}>
            <Calculator className="w-4 h-4" /> Tarjetas
          </button>
          <button onClick={() => setActiveTab('presupuesto')} className={`px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'presupuesto' ? 'border-eng-500 text-eng-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}>
            <DollarSign className="w-4 h-4" /> Presupuesto
          </button>
          <button onClick={() => setActiveTab('apu')} className={`px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'apu' ? 'border-eng-500 text-eng-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}>
            <Layers className="w-4 h-4" /> APU
          </button>
        </div>
      </div>

      <div className="min-h-[500px]">
        {/* --- TAB MEMORIA --- */}
        {activeTab === 'memoria' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               
               {/* Columna Izquierda: Información General */}
               <div className="space-y-6">
                  {/* Empresa / Ingeniero */}
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                      <div className="flex items-center gap-2 mb-4 text-eng-400">
                          <Briefcase className="w-5 h-5" />
                          <h3 className="font-bold uppercase tracking-wider text-sm">Responsable</h3>
                      </div>
                      <div className="space-y-2 text-sm text-slate-300">
                          <p><span className="text-slate-500 block text-xs">Ingeniero:</span> {data.memoriaDescriptiva.informacionEmpresa?.nombreIngeniero}</p>
                          <p><span className="text-slate-500 block text-xs">C.I.V.:</span> {data.memoriaDescriptiva.informacionEmpresa?.civ}</p>
                          {data.memoriaDescriptiva.informacionEmpresa?.razonSocial && <p><span className="text-slate-500 block text-xs">Empresa:</span> {data.memoriaDescriptiva.informacionEmpresa.razonSocial}</p>}
                      </div>
                  </div>

                  {/* Ubicación / Predio */}
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                      <div className="flex items-center gap-2 mb-4 text-eng-400">
                          <MapPin className="w-5 h-5" />
                          <h3 className="font-bold uppercase tracking-wider text-sm">Predio</h3>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                          {data.memoriaDescriptiva.descripcionPredio}
                      </p>
                  </div>

                  {/* Marco Legal */}
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                      <div className="flex items-center gap-2 mb-4 text-eng-400">
                          <Scale className="w-5 h-5" />
                          <h3 className="font-bold uppercase tracking-wider text-sm">Marco Legal</h3>
                      </div>
                      <ul className="text-sm text-slate-300 space-y-2 list-disc pl-4">
                          {data.memoriaDescriptiva.marcoLegal?.map((norma, i) => (
                              <li key={i}>{norma}</li>
                          ))}
                      </ul>
                  </div>
               </div>

               {/* Columna Derecha: Contenido Principal */}
               <div className="lg:col-span-2 space-y-6">
                  {/* Introducción */}
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
                       <h3 className="text-xl font-bold text-white mb-4">1. Introducción</h3>
                       <div className="text-slate-300 leading-relaxed whitespace-pre-line text-justify">
                           {data.memoriaDescriptiva.introduccion}
                       </div>
                  </div>

                  {/* Descripción del Proyecto */}
                  <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
                       <div className="flex items-center gap-2 mb-4 text-eng-400">
                          <FileText className="w-6 h-6" />
                          <h3 className="text-xl font-bold text-white">2. Descripción Arquitectónica y Constructiva</h3>
                       </div>
                       <div className="text-slate-300 leading-relaxed whitespace-pre-line text-justify mb-6">
                           {data.memoriaDescriptiva.descripcionProyecto}
                       </div>
                  </div>

                  {/* NUEVAS SECCIONES DE CÁLCULO DETALLADO */}
                  <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white pl-2 border-l-4 border-eng-500">3. Memorias de Cálculo (Desarrollo)</h3>
                      
                      {/* ESTRUCTURA */}
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                         <div className="flex items-center gap-2 mb-4 text-orange-400">
                              <Ruler className="w-5 h-5" />
                              <h4 className="font-bold text-white">3.1 Cálculo Estructural y Cómputos Métricos</h4>
                          </div>
                          <div className="text-sm text-slate-300 font-mono leading-relaxed whitespace-pre-wrap bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                              {data.memoriaDescriptiva.calculosEstructuralesDetallados || "No disponible."}
                          </div>
                      </div>

                      {/* ELÉCTRICA */}
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                         <div className="flex items-center gap-2 mb-4 text-yellow-400">
                              <Zap className="w-5 h-5" />
                              <h4 className="font-bold text-white">3.2 Estudio de Cargas Eléctricas</h4>
                          </div>
                          <div className="text-sm text-slate-300 font-mono leading-relaxed whitespace-pre-wrap bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                              {data.memoriaDescriptiva.calculosElectricosDetallados || "No disponible."}
                          </div>
                      </div>

                      {/* SANITARIA */}
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                         <div className="flex items-center gap-2 mb-4 text-blue-400">
                              <Droplets className="w-5 h-5" />
                              <h4 className="font-bold text-white">3.3 Dotación y Capacidad Sanitaria</h4>
                          </div>
                          <div className="text-sm text-slate-300 font-mono leading-relaxed whitespace-pre-wrap bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                              {data.memoriaDescriptiva.calculosSanitariosDetallados || "No disponible."}
                          </div>
                      </div>

                       {/* MECÁNICA */}
                       <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                         <div className="flex items-center gap-2 mb-4 text-red-400">
                              <Thermometer className="w-5 h-5" />
                              <h4 className="font-bold text-white">3.4 Cargas Térmicas (Mecánica)</h4>
                          </div>
                          <div className="text-sm text-slate-300 font-mono leading-relaxed whitespace-pre-wrap bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                              {data.memoriaDescriptiva.calculosMecanicosDetallados || "No disponible."}
                          </div>
                      </div>
                  </div>

                  {/* Servicios y Etapas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                          <div className="flex items-center gap-2 mb-4 text-eng-400">
                              <ListOrdered className="w-5 h-5" />
                              <h3 className="font-bold text-white">Etapas Constructivas</h3>
                          </div>
                          <ol className="text-sm text-slate-300 space-y-2 list-decimal pl-4">
                              {data.memoriaDescriptiva.etapasConstructivas?.map((etapa, i) => (
                                  <li key={i}>{etapa}</li>
                              ))}
                          </ol>
                      </div>
                      
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                          <div className="flex items-center gap-2 mb-4 text-eng-400">
                              <Check className="w-5 h-5" />
                              <h3 className="font-bold text-white">Conclusiones</h3>
                          </div>
                          <p className="text-sm text-slate-300">{data.memoriaDescriptiva.conclusiones}</p>
                      </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* --- TAB CALCULOS (RESUMEN TARJETAS) --- */}
        {activeTab === 'calculos' && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.memoriaCalculo.map((calc, idx) => (
                   <CalculationCard key={idx} item={calc} />
              ))}
              {data.memoriaCalculo.length === 0 && <div className="col-span-3 text-center text-slate-500 py-10">Generando cálculos...</div>}
            </div>
        )}

        {/* --- TAB PRESUPUESTO (RESUMEN) --- */}
        {activeTab === 'presupuesto' && (
          <div className="animate-fade-in space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* TABLA PRINCIPAL */}
              <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg overflow-hidden flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                   <h2 className="text-lg font-bold text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-eng-500" /> Presupuesto General</h2>
                   
                   {/* Table Filter */}
                   <div className="relative w-full sm:w-auto">
                     <Search className="absolute left-3 top-2.5 text-slate-500 w-4 h-4" />
                     <input 
                        type="text" 
                        placeholder="Filtrar por Partida o Código..." 
                        value={budgetSearchTerm}
                        onChange={(e) => setBudgetSearchTerm(e.target.value)}
                        className="w-full sm:w-64 bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-eng-500"
                     />
                   </div>
                </div>

                <div className="overflow-x-auto flex-grow">
                  <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 cursor-pointer select-none">
                      <tr>
                        <th className="w-10 px-2 py-3"></th> {/* Expansion Toggle */}
                        <th className="px-4 py-3 hover:text-white" onClick={() => handleSort('codigo')}>
                            <div className="flex items-center gap-1">Código <ArrowUpDown className="w-3 h-3" /></div>
                        </th>
                        <th className="px-4 py-3 hover:text-white" onClick={() => handleSort('descripcion')}>
                            <div className="flex items-center gap-1">Partida <ArrowUpDown className="w-3 h-3" /></div>
                        </th>
                        <th className="px-4 py-3 text-right hover:text-white" onClick={() => handleSort('metrado')}>
                            <div className="flex items-center justify-end gap-1">Cant. <ArrowUpDown className="w-3 h-3" /></div>
                        </th>
                        <th className="px-4 py-3 text-right hover:text-white" onClick={() => handleSort('precioUnitario')}>
                            <div className="flex items-center justify-end gap-1">P. Unitario <ArrowUpDown className="w-3 h-3" /></div>
                        </th>
                        <th className="px-4 py-3 text-right hover:text-white" onClick={() => handleSort('precioTotal')}>
                            <div className="flex items-center justify-end gap-1">Total <ArrowUpDown className="w-3 h-3" /></div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {sortedBudget.map((partida) => (
                        <React.Fragment key={partida.codigo}>
                        <tr className={`hover:bg-slate-700/30 transition-colors ${expandedBudgetRow === partida.codigo ? 'bg-slate-800/80' : ''}`}>
                          <td className="px-2 py-3 text-center">
                              <button 
                                onClick={() => setExpandedBudgetRow(expandedBudgetRow === partida.codigo ? null : partida.codigo)}
                                className="text-slate-500 hover:text-eng-400 transition-colors"
                              >
                                {expandedBudgetRow === partida.codigo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">{partida.codigo}</td>
                          <td className="px-4 py-3 font-medium text-slate-200">
                              {partida.descripcion}
                              {(partida.factorAjuste ?? 0) !== 0 && (
                                  <span className="ml-2 text-[9px] bg-indigo-900/60 text-indigo-200 px-1 rounded border border-indigo-700">
                                      +{partida.factorAjuste}% Ajuste
                                  </span>
                              )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-eng-300">
                            {isEditing ? (
                              <input 
                                type="number" 
                                value={partida.metrado} 
                                onChange={(e) => handleBudgetChange((partida as any).originalIndex, 'metrado', e.target.value)} 
                                className="w-20 bg-slate-900 border border-slate-600 rounded px-1 text-right text-xs text-white focus:border-eng-500 outline-none" 
                              />
                            ) : partida.metrado.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-400">
                              ${partida.precioUnitario.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-200">
                              ${partida.precioTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </td>
                        </tr>
                        {/* SUBMENU: EXPANDED MATERIAL DETAILS */}
                        {expandedBudgetRow === partida.codigo && (
                           <tr className="bg-slate-900/40 animate-fade-in-down">
                              <td colSpan={6} className="p-0">
                                 <div className="p-4 pl-12 border-l-2 border-eng-500 m-2 ml-4 bg-slate-950/30 rounded-r-lg">
                                    <h4 className="text-xs font-bold text-eng-400 mb-3 flex items-center gap-2">
                                       <PackageCheck className="w-3 h-3" />
                                       LISTA DETALLADA DE MATERIALES
                                    </h4>
                                    <div className="overflow-x-auto">
                                       <table className="w-full text-xs text-left">
                                          <thead>
                                             <tr className="text-slate-500 border-b border-slate-700/50">
                                                <th className="pb-2 font-medium">Descripción Material</th>
                                                <th className="pb-2 text-right">Cant. Unitaria</th>
                                                <th className="pb-2 text-right">Costo Unit.</th>
                                                <th className="pb-2 text-right">Subtotal</th>
                                                <th className="pb-2 text-right w-32">Total Partida ({partida.metrado})</th>
                                             </tr>
                                          </thead>
                                          <tbody className="text-slate-300 divide-y divide-slate-800/50">
                                             {partida.apu.materiales.map((mat, mIdx) => {
                                                const subtotal = mat.cantidad * mat.costoUnitario * (1 + (mat.desperdicio || 0)/100);
                                                return (
                                                   <tr key={mIdx}>
                                                      <td className="py-2 pr-2">{mat.descripcion}</td>
                                                      <td className="py-2 text-right text-slate-400">{mat.cantidad} {mat.unidad}</td>
                                                      <td className="py-2 text-right font-mono">${mat.costoUnitario.toFixed(2)}</td>
                                                      <td className="py-2 text-right font-mono">${subtotal.toFixed(2)}</td>
                                                      <td className="py-2 text-right font-mono font-bold text-eng-300">
                                                         ${(subtotal * partida.metrado).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                      </td>
                                                   </tr>
                                                );
                                             })}
                                             {partida.apu.materiales.length === 0 && (
                                                <tr>
                                                   <td colSpan={5} className="py-4 text-center text-slate-600 italic">No hay materiales desglosados para esta partida.</td>
                                                </tr>
                                             )}
                                          </tbody>
                                       </table>
                                    </div>
                                    <div className="mt-2 text-[10px] text-slate-500 text-right">
                                       * Incluye desperdicios. Ver detalle completo en pestaña APU.
                                    </div>
                                 </div>
                              </td>
                           </tr>
                        )}
                        </React.Fragment>
                      ))}
                      {sortedBudget.length === 0 && (
                          <tr>
                              <td colSpan={6} className="text-center py-8 text-slate-500 italic">No se encontraron partidas con ese filtro.</td>
                          </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-900 border-t border-slate-700">
                         <tr>
                            <td colSpan={4} className="px-4 py-3 text-right font-medium text-slate-400">SUBTOTAL GENERAL</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-300">${totalPresupuesto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td></td>
                         </tr>
                         <tr>
                            <td colSpan={4} className="px-4 py-3 text-right font-medium text-slate-400 flex items-center justify-end gap-2">
                                IVA 
                                {isEditing ? <input className="w-12 bg-slate-800 text-right border border-slate-600 rounded px-1 text-white" value={data.presupuestoConfig.porcentajeIVA} onChange={(e)=>handleConfigChange('porcentajeIVA', e.target.value)} /> : `(${data.presupuestoConfig.porcentajeIVA}%)`}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-300">${montoIVA.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td></td>
                         </tr>
                         <tr>
                            <td colSpan={4} className="px-4 py-3 text-right font-bold text-white text-lg">TOTAL PRESUPUESTO</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-eng-400 text-lg">${totalGeneral.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td></td>
                         </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* GRAFICO Y RESUMEN LATERAL */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col h-fit sticky top-24">
                 <h3 className="text-sm font-semibold text-slate-200 mb-4 uppercase tracking-wider">Distribución de Costos</h3>
                 <div className="w-full h-64">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie data={costDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                         {costDistribution.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                       </Pie>
                       <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px', color: '#f1f5f9' }} formatter={(value: number) => `$${value.toLocaleString(undefined, {maximumFractionDigits: 0})}`}/>
                       <Legend verticalAlign="bottom" height={36} iconType="circle" />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
                 <div className="mt-4 pt-4 border-t border-slate-700 space-y-2 text-xs">
                     <div className="flex justify-between text-slate-400"><span>Anticipo ({data.presupuestoConfig.porcentajeAnticipo}%)</span> <span className="text-slate-200">${montoAnticipo.toLocaleString()}</span></div>
                     <div className="flex justify-between text-slate-400"><span>Validez Oferta</span> <span className="text-slate-200">{data.presupuestoConfig.diasValidez} Días</span></div>
                 </div>
              </div>

            </div>
          </div>
        )}

        {/* --- TAB APU (DETALLE INDEPENDIENTE) --- */}
        {activeTab === 'apu' && (
            <div className="animate-fade-in space-y-6">
                {/* Search Bar for APUs */}
                <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 ml-2" />
                    <input 
                        type="text" 
                        placeholder="Buscar partida por código o descripción..." 
                        className="bg-transparent border-none focus:ring-0 text-slate-200 text-sm w-full placeholder-slate-500 outline-none"
                        value={apuSearchTerm}
                        onChange={(e) => setApuSearchTerm(e.target.value)}
                    />
                </div>

                <div className="space-y-4">
                    {filteredAPUs.map(({partida, index: originalIndex}) => (
                        <div key={partida.codigo} className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800">
                             <div 
                                className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${expandedApuIndex === originalIndex ? 'bg-eng-900/30 border-b border-slate-700' : 'hover:bg-slate-700/50'}`}
                                onClick={() => setExpandedApuIndex(expandedApuIndex === originalIndex ? null : originalIndex)}
                             >
                                <div className="flex items-center gap-4">
                                    <span className="font-mono text-xs text-eng-400 bg-eng-950/50 border border-eng-900 px-2 py-1 rounded">{partida.codigo}</span>
                                    <span className="font-medium text-slate-200 text-sm">{partida.descripcion}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-slate-400 text-sm font-mono">${partida.precioUnitario.toFixed(2)}</span>
                                    {expandedApuIndex === originalIndex ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                </div>
                             </div>

                             {expandedApuIndex === originalIndex && (
                                <div className="p-4 bg-slate-900/50">
                                  {/* PLANILLA APU ESTILO LULO (White Paper) */}
                                  <div className="bg-white text-slate-900 p-6 shadow-xl max-w-5xl mx-auto border border-slate-300">
                                      {/* Header Planilla */}
                                      <div className="border border-slate-400 mb-4 bg-white">
                                        <div className="grid grid-cols-4 text-xs">
                                            <div className="p-2 border-r border-slate-300 font-bold bg-slate-200 text-slate-900">Partida Nº: {partida.codigo}</div>
                                            <div className="p-2 border-r border-slate-300 col-span-3 font-bold text-slate-900">{partida.descripcion}</div>
                                            
                                            <div className="p-2 border-r border-t border-slate-300 font-bold bg-slate-200 text-slate-900">Unidad:</div>
                                            <div className="p-2 border-r border-t border-slate-300 text-slate-900">{partida.unidad}</div>
                                            <div className="p-2 border-r border-t border-slate-300 font-bold bg-slate-200 text-slate-900">Cantidad Total:</div>
                                            <div className="p-2 border-t border-slate-300 text-slate-900">{partida.metrado}</div>
                                            
                                            <div className="p-2 border-r border-t border-slate-300 font-bold bg-slate-200 text-slate-900">Rendimiento:</div>
                                            <div className="p-2 border-r border-t border-slate-300 col-span-3 flex items-center gap-2 text-slate-900 bg-yellow-50">
                                                <input 
                                                    className="w-24 border-0 border-b border-slate-400 px-1 bg-transparent text-slate-900 font-bold focus:ring-0 text-right" 
                                                    type="number" 
                                                    step="any"
                                                    value={partida.apu.rendimiento} 
                                                    onChange={(e) => handleAPUGlobalChange(originalIndex, 'rendimiento', e.target.value, 'number')} 
                                                />
                                                <span className="text-slate-600 text-[10px]">{partida.apu.rendimientoUnidad}</span>
                                            </div>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 gap-4 text-xs text-slate-900">
                                          {/* MATERIALES */}
                                          <div className="border border-slate-300 bg-white">
                                              <div className="bg-slate-200 font-bold p-1 px-2 border-b border-slate-300 text-slate-900">1. MATERIALES</div>
                                              <table className="w-full">
                                                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                                      <tr>
                                                          <th className="text-left p-1 px-2 font-normal">Descripción</th>
                                                          <th className="text-center p-1 font-normal w-12">Unidad</th>
                                                          <th className="text-right p-1 font-normal w-20">Cant.</th>
                                                          <th className="text-right p-1 font-normal w-16">% Desp.</th>
                                                          <th className="text-right p-1 font-normal w-24">Costo</th>
                                                          <th className="text-right p-1 px-2 font-normal w-24">Total</th>
                                                      </tr>
                                                  </thead>
                                                  <tbody className="text-slate-900">
                                                      {partida.apu.materiales.map((m, i) => (
                                                          <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                              <td className="p-1 px-2">{m.descripcion}</td>
                                                              <td className="text-center p-1">{m.unidad}</td>
                                                              <td className="text-right p-1">
                                                                  <input className="w-full text-right border-0 bg-transparent text-slate-900 px-1 focus:bg-yellow-100 outline-none" type="number" step="any" value={m.cantidad} onChange={(e) => handleAPUItemChange(originalIndex, 'materiales', i, 'cantidad', e.target.value)}/>
                                                              </td>
                                                              <td className="text-right p-1">
                                                                  <input className="w-full text-right border-0 bg-transparent text-slate-900 px-1 focus:bg-yellow-100 outline-none" type="number" step="any" value={m.desperdicio} onChange={(e) => handleAPUItemChange(originalIndex, 'materiales', i, 'desperdicio', e.target.value)}/>
                                                              </td>
                                                              <td className="text-right p-1">
                                                                  <input className="w-full text-right border-0 bg-transparent text-slate-900 px-1 focus:bg-yellow-100 outline-none" type="number" step="any" value={m.costoUnitario} onChange={(e) => handleAPUItemChange(originalIndex, 'materiales', i, 'costoUnitario', e.target.value)}/>
                                                              </td>
                                                              <td className="text-right p-1 px-2 font-bold">{m.total.toFixed(2)}</td>
                                                          </tr>
                                                      ))}
                                                  </tbody>
                                              </table>
                                              <div className="bg-slate-50 text-right p-1 px-2 border-t border-slate-300 font-bold text-slate-900">
                                                  Total Materiales: {partida.apu.materiales.reduce((a, b) => a + b.total, 0).toFixed(2)}
                                              </div>
                                          </div>

                                          {/* EQUIPOS */}
                                          <div className="border border-slate-300 bg-white">
                                              <div className="bg-slate-200 font-bold p-1 px-2 border-b border-slate-300 text-slate-900">2. EQUIPOS</div>
                                              <table className="w-full">
                                                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                                      <tr>
                                                          <th className="text-left p-1 px-2 font-normal">Descripción</th>
                                                          <th className="text-right p-1 font-normal w-20">Cant.</th>
                                                          <th className="text-right p-1 font-normal w-24">Costo/Día</th>
                                                          <th className="text-right p-1 px-2 font-normal w-24">Total</th>
                                                      </tr>
                                                  </thead>
                                                  <tbody className="text-slate-900">
                                                      {partida.apu.equipos.map((m, i) => (
                                                          <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                              <td className="p-1 px-2">{m.descripcion}</td>
                                                              <td className="text-right p-1">
                                                                  <input className="w-full text-right border-0 bg-transparent text-slate-900 px-1 focus:bg-yellow-100 outline-none" type="number" step="any" value={m.cantidad} onChange={(e) => handleAPUItemChange(originalIndex, 'equipos', i, 'cantidad', e.target.value)}/>
                                                              </td>
                                                              <td className="text-right p-1">
                                                                  <input className="w-full text-right border-0 bg-transparent text-slate-900 px-1 focus:bg-yellow-100 outline-none" type="number" step="any" value={m.costoUnitario} onChange={(e) => handleAPUItemChange(originalIndex, 'equipos', i, 'costoUnitario', e.target.value)}/>
                                                              </td>
                                                              <td className="text-right p-1 px-2 font-bold">{m.total.toFixed(2)}</td>
                                                          </tr>
                                                      ))}
                                                  </tbody>
                                              </table>
                                              <div className="bg-slate-50 text-right p-1 px-2 border-t border-slate-300 font-bold text-slate-900">
                                                  Total Equipos: {partida.apu.equipos.reduce((a, b) => a + b.total, 0).toFixed(2)}
                                              </div>
                                          </div>

                                          {/* MANO DE OBRA */}
                                          <div className="border border-slate-300 bg-white">
                                              <div className="bg-slate-200 font-bold p-1 px-2 border-b border-slate-300 text-slate-900">3. MANO DE OBRA</div>
                                              <table className="w-full">
                                                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                                      <tr>
                                                          <th className="text-left p-1 px-2 font-normal">Descripción</th>
                                                          <th className="text-right p-1 font-normal w-20">Cant.</th>
                                                          <th className="text-right p-1 font-normal w-24">Jornal</th>
                                                          <th className="text-right p-1 px-2 font-normal w-24">Total</th>
                                                      </tr>
                                                  </thead>
                                                  <tbody className="text-slate-900">
                                                      {partida.apu.manoDeObra.map((m, i) => (
                                                          <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                              <td className="p-1 px-2">{m.descripcion}</td>
                                                              <td className="text-right p-1">
                                                                  <input className="w-full text-right border-0 bg-transparent text-slate-900 px-1 focus:bg-yellow-100 outline-none" type="number" step="any" value={m.cantidad} onChange={(e) => handleAPUItemChange(originalIndex, 'manoDeObra', i, 'cantidad', e.target.value)}/>
                                                              </td>
                                                              <td className="text-right p-1">
                                                                  <input className="w-full text-right border-0 bg-transparent text-slate-900 px-1 focus:bg-yellow-100 outline-none" type="number" step="any" value={m.costoUnitario} onChange={(e) => handleAPUItemChange(originalIndex, 'manoDeObra', i, 'costoUnitario', e.target.value)}/>
                                                              </td>
                                                              <td className="text-right p-1 px-2 font-bold">{m.total.toFixed(2)}</td>
                                                          </tr>
                                                      ))}
                                                  </tbody>
                                              </table>
                                              
                                              {/* Footer Mano de Obra (Calculos Laborales) */}
                                              <div className="bg-slate-50 p-3 border-t border-slate-300 space-y-2 text-slate-900">
                                                  <div className="flex justify-between border-b border-slate-200 pb-1">
                                                      <span>Subtotal Salarios (Base):</span>
                                                      <span>{partida.apu.manoDeObra.reduce((a,b)=>a+b.total,0).toFixed(2)}</span>
                                                  </div>
                                                  
                                                  {/* CAS - Prestaciones Sociales */}
                                                  <div className="flex justify-between items-center text-slate-700 bg-yellow-50/50 p-1 rounded">
                                                      <span className="flex items-center gap-2 font-semibold">
                                                          Prestaciones Sociales (CAS) %
                                                          <input 
                                                            className="w-16 text-right border-0 border-b border-slate-400 bg-transparent text-slate-900 font-bold px-1 focus:ring-0" 
                                                            value={partida.apu.laborCASPorcentaje} 
                                                            onChange={(e)=>handleAPUGlobalChange(originalIndex, 'laborCASPorcentaje', e.target.value, 'number')} 
                                                          />
                                                      </span>
                                                      <span className="font-mono">{(partida.apu.manoDeObra.reduce((a,b)=>a+b.total,0) * (partida.apu.laborCASPorcentaje/100)).toFixed(2)}</span>
                                                  </div>

                                                  {/* Cesta Ticket */}
                                                  <div className="flex justify-between items-center text-slate-700 bg-yellow-50/50 p-1 rounded">
                                                       <span className="flex items-center gap-2 font-semibold">
                                                          Bono Alimentación (Cesta Ticket) $/jornada
                                                          <input 
                                                            className="w-16 text-right border-0 border-b border-slate-400 bg-transparent text-slate-900 font-bold px-1 focus:ring-0" 
                                                            value={partida.apu.laborCestaTicket} 
                                                            onChange={(e)=>handleAPUGlobalChange(originalIndex, 'laborCestaTicket', e.target.value, 'number')} 
                                                          />
                                                      </span>
                                                      <span className="font-mono">
                                                          {(partida.apu.manoDeObra.reduce((a,b)=>a+b.cantidad,0) * partida.apu.laborCestaTicket).toFixed(2)}
                                                      </span>
                                                  </div>

                                                  <div className="flex justify-between font-bold border-t border-slate-300 pt-2 text-slate-900 text-sm">
                                                      <span>TOTAL MANO DE OBRA (Salarios + Prestaciones + Bonos):</span>
                                                      <span>
                                                          {(
                                                              partida.apu.manoDeObra.reduce((a,b)=>a+b.total,0) +
                                                              (partida.apu.manoDeObra.reduce((a,b)=>a+b.total,0) * (partida.apu.laborCASPorcentaje/100)) +
                                                              (partida.apu.manoDeObra.reduce((a,b)=>a+b.cantidad,0) * partida.apu.laborCestaTicket)
                                                          ).toFixed(2)}
                                                      </span>
                                                  </div>
                                              </div>
                                          </div>

                                          {/* RESUMEN FINAL APU (CASCADA) */}
                                          <div className="border-2 border-slate-800 p-4 bg-slate-50 mt-2">
                                              {(() => {
                                                  const mat = partida.apu.materiales.reduce((acc, c) => acc + c.total, 0);
                                                  const eq = partida.apu.equipos.reduce((acc, c) => acc + c.total, 0);
                                                  // Calculo Lulo
                                                  const laborBase = partida.apu.manoDeObra.reduce((acc, c) => acc + c.total, 0);
                                                  const laborCAS = laborBase * (partida.apu.laborCASPorcentaje / 100);
                                                  const laborBono = partida.apu.manoDeObra.reduce((acc, c) => acc + c.cantidad, 0) * partida.apu.laborCestaTicket;
                                                  const moTotal = laborBase + laborCAS + laborBono;
                                                  
                                                  const cd = mat + eq + moTotal;
                                                  const admin = cd * (partida.apu.administracionPorcentaje / 100);
                                                  const subtotal = cd + admin;
                                                  const utilidad = subtotal * (partida.apu.utilidadPorcentaje / 100);
                                                  const precioPrevio = subtotal + utilidad;
                                                  const ajuste = precioPrevio * ((partida.factorAjuste || 0) / 100);
                                                  const precioFinal = precioPrevio + ajuste;

                                                  return (
                                                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right font-mono text-slate-900 text-sm">
                                                          <div className="text-slate-600 self-center">A. TOTAL MATERIALES:</div>
                                                          <div className="font-bold text-base bg-white border border-slate-200 p-1">{mat.toFixed(2)}</div>

                                                          <div className="text-slate-600 self-center">B. TOTAL EQUIPOS:</div>
                                                          <div className="font-bold text-base bg-white border border-slate-200 p-1">{eq.toFixed(2)}</div>

                                                          <div className="text-slate-600 self-center">C. TOTAL MANO DE OBRA:</div>
                                                          <div className="font-bold text-base bg-white border border-slate-200 p-1">{moTotal.toFixed(2)}</div>

                                                          <div className="col-span-2 border-b border-slate-300 my-2"></div>

                                                          <div className="text-slate-900 font-bold self-center">COSTO DIRECTO (A+B+C):</div>
                                                          <div className="font-bold text-base bg-slate-100 border border-slate-300 p-1">{cd.toFixed(2)}</div>
                                                          
                                                          <div className="text-slate-600 flex justify-end items-center gap-2">
                                                              Administración y Gastos %
                                                              <input className="w-16 border border-slate-400 text-center h-6 bg-white text-slate-900 font-bold" value={partida.apu.administracionPorcentaje} onChange={(e)=>handleAPUGlobalChange(originalIndex, 'administracionPorcentaje', e.target.value, 'number')}/>
                                                          </div>
                                                          <div className="p-1">{admin.toFixed(2)}</div>
                                                          
                                                          <div className="text-slate-900 font-bold border-t border-slate-300 pt-1">Sub-Total:</div>
                                                          <div className="border-t border-slate-300 font-bold pt-1">{subtotal.toFixed(2)}</div>

                                                          <div className="text-slate-600 flex justify-end items-center gap-2">
                                                              Utilidad e Imprevistos %
                                                              <input className="w-16 border border-slate-400 text-center h-6 bg-white text-slate-900 font-bold" value={partida.apu.utilidadPorcentaje} onChange={(e)=>handleAPUGlobalChange(originalIndex, 'utilidadPorcentaje', e.target.value, 'number')}/>
                                                          </div>
                                                          <div className="p-1">{utilidad.toFixed(2)}</div>

                                                          <div className="text-indigo-600 flex justify-end items-center gap-2 bg-indigo-50 py-1 px-2 rounded">
                                                              Factor Ajuste (Opcional) %
                                                              <input className="w-16 border border-indigo-300 text-center h-6 bg-white text-slate-900 font-bold" value={partida.factorAjuste} onChange={(e)=>handleAdjustmentFactorChange(originalIndex, e.target.value)}/>
                                                          </div>
                                                          <div className="bg-indigo-50 py-1 text-indigo-700 font-bold">{ajuste.toFixed(2)}</div>

                                                          <div className="text-black font-extrabold text-xl border-2 border-black p-2 mt-2 flex justify-between col-span-2 items-center px-4 bg-yellow-200">
                                                              <span>PRECIO UNITARIO FINAL</span>
                                                              <span>$ {precioFinal.toFixed(2)}</span>
                                                          </div>
                                                      </div>
                                                  )
                                              })()}
                                          </div>
                                      </div>
                                    </div>
                                </div>
                             )}
                        </div>
                    ))}

                    {filteredAPUs.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            No se encontraron partidas con ese criterio de búsqueda.
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default ResultsDashboard;