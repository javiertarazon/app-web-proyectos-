import React, { useState, useEffect } from 'react';
import { ProjectResponse, Partida, APUItem, PresupuestoConfig } from '../types';
import CalculationCard from './CalculationCard';
import { 
  FileText, 
  Calculator, 
  DollarSign, 
  BookOpen, 
  HardHat, 
  Truck, 
  Hammer, 
  ChevronDown, 
  ChevronUp,
  ClipboardList,
  Edit,
  Save,
  FileSpreadsheet,
  FileType,
  RefreshCw,
  Calendar,
  Percent
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

const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ data: initialData }) => {
  const [data, setData] = useState<ProjectResponse>(initialData);
  const [activeTab, setActiveTab] = useState<'memoria' | 'calculos' | 'presupuesto'>('memoria');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Sync state if initialData changes (new search)
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const toggleRow = (code: string) => {
    setExpandedRow(expandedRow === code ? null : code);
  };

  // --- Logic for Recalculating APU and Prices ---

  const recalculatePartida = (partida: Partida): Partida => {
    const sumTotal = (items: APUItem[]) => items.reduce((acc, item) => acc + (item.cantidad * item.costoUnitario), 0);
    
    // 1. Calculate Direct Costs
    const totalMateriales = sumTotal(partida.apu.materiales);
    const totalEquipos = sumTotal(partida.apu.equipos);
    const totalManoDeObra = sumTotal(partida.apu.manoDeObra);
    
    const costoDirecto = totalMateriales + totalEquipos + totalManoDeObra;

    // 2. Calculate Indirect Costs (Cascading or Direct Base)
    // Formula: CD + (CD * %Admin) -> Subtotal + (Subtotal * %Utilidad)
    const adminMonto = costoDirecto * (partida.apu.administracionPorcentaje / 100);
    const subtotal = costoDirecto + adminMonto;
    const utilidadMonto = subtotal * (partida.apu.utilidadPorcentaje / 100);
    
    const nuevoPrecioUnitario = subtotal + utilidadMonto;

    return {
      ...partida,
      precioUnitario: nuevoPrecioUnitario,
      precioTotal: nuevoPrecioUnitario * partida.metrado,
      apu: {
        ...partida.apu,
        // Update individual item totals strictly for display consistency (though calculated on fly usually)
        materiales: partida.apu.materiales.map(i => ({...i, total: i.cantidad * i.costoUnitario})),
        equipos: partida.apu.equipos.map(i => ({...i, total: i.cantidad * i.costoUnitario})),
        manoDeObra: partida.apu.manoDeObra.map(i => ({...i, total: i.cantidad * i.costoUnitario})),
      }
    };
  };

  // --- Handlers for Editable Fields ---

  const handleMemoriaChange = (field: keyof typeof data.memoriaDescriptiva, value: string) => {
    setData(prev => ({
      ...prev,
      memoriaDescriptiva: { ...prev.memoriaDescriptiva, [field]: value }
    }));
  };

  const handleBudgetChange = (index: number, field: keyof Partida, value: string | number) => {
    const newData = { ...data };
    let partida = { ...newData.presupuesto[index] };
    
    if (field === 'metrado') {
      partida.metrado = Number(value);
      partida.precioTotal = partida.metrado * partida.precioUnitario;
    } else if (field === 'precioUnitario') {
      // Manual override of Unit Price (breaks APU logic slightly, but allowed for top-level edit)
      partida.precioUnitario = Number(value);
      partida.precioTotal = partida.metrado * partida.precioUnitario;
    } else {
      (partida as any)[field] = value;
    }
    
    newData.presupuesto[index] = partida;
    setData(newData);
  };

  // Deep edit for APU Items
  const handleAPUItemChange = (
    partidaIndex: number, 
    category: 'materiales' | 'equipos' | 'manoDeObra', 
    itemIndex: number, 
    field: keyof APUItem, 
    value: string | number
  ) => {
    const newData = { ...data };
    const partida = { ...newData.presupuesto[partidaIndex] };
    const items = [...partida.apu[category]];
    const item = { ...items[itemIndex] };

    // Update Field
    (item as any)[field] = field === 'descripcion' || field === 'unidad' ? value : Number(value);
    
    // Update Item Total immediately
    if (field === 'cantidad' || field === 'costoUnitario') {
      item.total = item.cantidad * item.costoUnitario;
    }

    items[itemIndex] = item;
    partida.apu = { ...partida.apu, [category]: items };
    
    // Full Recalculation
    const recalculatedPartida = recalculatePartida(partida);
    newData.presupuesto[partidaIndex] = recalculatedPartida;
    
    setData(newData);
  };

  const handleAPUMarkupChange = (partidaIndex: number, field: 'administracionPorcentaje' | 'utilidadPorcentaje', value: string) => {
    const newData = { ...data };
    const partida = { ...newData.presupuesto[partidaIndex] };
    
    partida.apu = { ...partida.apu, [field]: Number(value) };
    
    const recalculatedPartida = recalculatePartida(partida);
    newData.presupuesto[partidaIndex] = recalculatedPartida;
    
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


  // --- Export Functions ---

  const downloadMemoriaMarkdown = () => {
    let md = `# ${data.projectTitle}\n\n`;
    md += `**Disciplina:** ${data.discipline}\n\n`;
    md += `## 1. Memoria Descriptiva\n\n`;
    md += `### Objetivo\n${data.memoriaDescriptiva.objetivo}\n\n`;
    md += `### Alcance\n${data.memoriaDescriptiva.alcance}\n\n`;
    md += `### Ubicación\n${data.memoriaDescriptiva.ubicacion}\n\n`;
    md += `### Metodología\n${data.memoriaDescriptiva.metodologiaEjecucion}\n\n`;
    md += `### Especificaciones Técnicas\n`;
    data.memoriaDescriptiva.especificacionesTecnicas.forEach(s => md += `- ${s}\n`);
    md += `\n## 2. Conclusiones\n${data.conclusiones}\n`;
    
    downloadFile(md, `Memoria_${data.projectTitle.substring(0, 10)}.md`, 'text/markdown');
  };

  const downloadBudgetCSV = () => {
    let csv = "Codigo,Descripcion,Unidad,Metrado,Precio Unitario,Precio Total\n";
    let subtotal = 0;
    data.presupuesto.forEach(p => {
      const desc = `"${p.descripcion.replace(/"/g, '""')}"`;
      csv += `${p.codigo},${desc},${p.unidad},${p.metrado},${p.precioUnitario.toFixed(2)},${p.precioTotal.toFixed(2)}\n`;
      subtotal += p.precioTotal;
    });

    // Add Summary
    const iva = subtotal * (data.presupuestoConfig.porcentajeIVA / 100);
    const total = subtotal + iva;
    const anticipo = total * (data.presupuestoConfig.porcentajeAnticipo / 100);

    csv += `\n,,,,,Subtotal,${subtotal.toFixed(2)}\n`;
    csv += `,,,,,IVA (${data.presupuestoConfig.porcentajeIVA}%),${iva.toFixed(2)}\n`;
    csv += `,,,,,TOTAL GENERAL,${total.toFixed(2)}\n`;
    csv += `\n,,,,,Anticipo (${data.presupuestoConfig.porcentajeAnticipo}%),${anticipo.toFixed(2)}\n`;
    csv += `,,,,,Validez Oferta,${data.presupuestoConfig.diasValidez} dias\n`;

    downloadFile(csv, `Presupuesto_${data.projectTitle.substring(0, 10)}.csv`, 'text/csv');
  };

  // --- Calculations for Chart ---

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

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in pb-20">
      
      {/* Header & Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 pb-4 mb-2 sticky top-[4rem] z-40 pt-4 -mt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-eng-500 font-mono text-xs uppercase tracking-widest border border-eng-900 bg-eng-950 px-2 py-0.5 rounded">
                {data.discipline}
              </span>
              <span className="text-slate-500 text-xs">Expediente Técnico</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{data.projectTitle}</h1>
          </div>
          
          {/* Action Toolbar */}
          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700 shadow-lg">
             <button 
               onClick={() => setIsEditing(!isEditing)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${isEditing ? 'bg-eng-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
             >
               {isEditing ? <Save className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
               {isEditing ? 'Terminar Edición' : 'Editar Datos'}
             </button>
             <div className="w-px h-6 bg-slate-700 mx-1"></div>
             <div className="flex items-center gap-1">
               <span className="text-[10px] text-slate-500 uppercase px-2">Descargar:</span>
               <button onClick={downloadMemoriaMarkdown} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded tooltip" title="Descargar Memoria (MD/Texto)">
                 <FileType className="w-4 h-4" />
               </button>
               <button onClick={downloadBudgetCSV} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded" title="Descargar Presupuesto (CSV)">
                 <FileSpreadsheet className="w-4 h-4" />
               </button>
             </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex border-b border-slate-700 space-x-1 overflow-x-auto">
          <button onClick={() => setActiveTab('memoria')} className={`px-6 py-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'memoria' ? 'border-eng-500 text-eng-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}>
            <FileText className="w-4 h-4" /> Memoria Descriptiva
          </button>
          <button onClick={() => setActiveTab('calculos')} className={`px-6 py-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'calculos' ? 'border-eng-500 text-eng-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}>
            <Calculator className="w-4 h-4" /> Memoria de Cálculo
          </button>
          <button onClick={() => setActiveTab('presupuesto')} className={`px-6 py-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'presupuesto' ? 'border-eng-500 text-eng-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}>
            <DollarSign className="w-4 h-4" /> Presupuesto y APU
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[500px]">
        
        {/* TAB: Memoria Descriptiva */}
        {activeTab === 'memoria' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
            <div className="lg:col-span-2 space-y-6">
              <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 relative group">
                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-eng-500" /> Objetivo y Alcance
                </h3>
                <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                  <div>
                    <strong className="block text-slate-400 text-xs uppercase mb-1">Objetivo del Proyecto</strong>
                    {isEditing ? (
                      <textarea 
                        value={data.memoriaDescriptiva.objetivo}
                        onChange={(e) => handleMemoriaChange('objetivo', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 min-h-[100px]"
                      />
                    ) : (
                      <p>{data.memoriaDescriptiva.objetivo}</p>
                    )}
                  </div>
                  <div>
                    <strong className="block text-slate-400 text-xs uppercase mb-1">Alcance (Scope) - Detallado</strong>
                    {isEditing ? (
                      <textarea 
                        value={data.memoriaDescriptiva.alcance}
                        onChange={(e) => handleMemoriaChange('alcance', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 min-h-[300px] font-mono text-xs"
                      />
                    ) : (
                      <p className="whitespace-pre-line text-justify">{data.memoriaDescriptiva.alcance}</p>
                    )}
                  </div>
                  <div>
                    <strong className="block text-slate-400 text-xs uppercase mb-1">Ubicación y Condiciones</strong>
                    {isEditing ? (
                      <textarea 
                        value={data.memoriaDescriptiva.ubicacion}
                        onChange={(e) => handleMemoriaChange('ubicacion', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 min-h-[100px]"
                      />
                    ) : (
                      <p className="whitespace-pre-line text-justify">{data.memoriaDescriptiva.ubicacion}</p>
                    )}
                  </div>
                </div>
              </section>

              <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <HardHat className="w-5 h-5 text-eng-500" /> Metodología de Ejecución
                </h3>
                {isEditing ? (
                  <textarea 
                    value={data.memoriaDescriptiva.metodologiaEjecucion}
                    onChange={(e) => handleMemoriaChange('metodologiaEjecucion', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-slate-200 min-h-[300px]"
                  />
                ) : (
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line text-justify">
                    {data.memoriaDescriptiva.metodologiaEjecucion}
                  </p>
                )}
              </section>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-slate-200 mb-4 uppercase tracking-wider">Especificaciones Técnicas</h3>
                <ul className="space-y-3">
                  {data.memoriaDescriptiva.especificacionesTecnicas.map((spec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-eng-500 mt-1.5 flex-shrink-0"></span>
                      <span>{spec}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-slate-200 mb-4 uppercase tracking-wider">Normativa Aplicable</h3>
                <div className="flex flex-wrap gap-2">
                  {data.normativaAplicable.map((norm, i) => (
                    <span key={i} className="px-3 py-1 bg-slate-900 border border-slate-700 text-slate-300 rounded text-xs font-mono">
                      {norm}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* TAB: Memoria de Calculo (Solo Lectura por ahora) */}
        {activeTab === 'calculos' && (
          <div className="animate-fade-in space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.memoriaCalculo.map((calc, idx) => (
                <div key={idx} className="relative">
                   <CalculationCard item={calc} />
                   {calc.reference && (
                     <div className="absolute top-4 right-4 text-[10px] text-slate-500 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                       Ref: {calc.reference}
                     </div>
                   )}
                </div>
              ))}
            </div>
            
            <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mt-8">
              <h3 className="text-lg font-semibold text-slate-200 mb-2">Conclusiones Técnicas</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{data.conclusiones}</p>
            </div>
          </div>
        )}

        {/* TAB: Presupuesto y APU */}
        {activeTab === 'presupuesto' && (
          <div className="animate-fade-in space-y-8">
            
            {/* Chart Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                     <ClipboardList className="w-4 h-4" /> Presupuesto Detallado
                  </h3>
                  {isEditing && (
                    <div className="flex items-center gap-2 text-xs text-orange-400 bg-orange-900/20 px-3 py-1 rounded animate-pulse">
                      <RefreshCw className="w-3 h-3" />
                      <span>Modo Edición: Recálculo Automático Activo</span>
                    </div>
                  )}
                </div>
                
                <div className="overflow-x-auto flex-grow">
                  <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                      <tr>
                        <th className="px-4 py-3">Código</th>
                        <th className="px-4 py-3">Partida</th>
                        <th className="px-4 py-3 text-center">Und</th>
                        <th className="px-4 py-3 text-right">Metrado</th>
                        <th className="px-4 py-3 text-right">P.U. ($)</th>
                        <th className="px-4 py-3 text-right">Total ($)</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {data.presupuesto.map((partida, idx) => (
                        <React.Fragment key={partida.codigo}>
                          <tr 
                            className={`hover:bg-slate-700/30 transition-colors ${expandedRow === partida.codigo ? 'bg-slate-700/20' : ''}`}
                          >
                            <td className="px-4 py-3 font-mono text-xs text-slate-400">{partida.codigo}</td>
                            <td className="px-4 py-3 font-medium text-slate-200 cursor-pointer" onClick={() => toggleRow(partida.codigo)}>
                               {partida.descripcion}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-slate-400">{partida.unidad}</td>
                            <td className="px-4 py-3 text-right font-mono text-eng-300">
                              {isEditing ? (
                                <input 
                                  type="number"
                                  value={partida.metrado}
                                  onChange={(e) => handleBudgetChange(idx, 'metrado', e.target.value)}
                                  className="w-20 bg-slate-900 border border-slate-600 rounded px-1 text-right text-xs"
                                />
                              ) : (
                                partida.metrado.toLocaleString()
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-400">
                                {isEditing ? (
                                  <span className="text-slate-500 text-xs italic" title="Calculado desde APU">Auto</span>
                                ) : (
                                  `${partida.precioUnitario.toLocaleString(undefined, {minimumFractionDigits: 2})}`
                                )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-200">${partida.precioTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td className="px-4 py-3 text-center text-slate-500 cursor-pointer" onClick={() => toggleRow(partida.codigo)}>
                              {expandedRow === partida.codigo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </td>
                          </tr>
                          
                          {/* EXPANDED APU SECTION */}
                          {expandedRow === partida.codigo && (
                            <tr>
                              <td colSpan={7} className="px-0 py-0 bg-slate-900/30 border-y border-slate-700/50">
                                <div className="p-4 pl-8 lg:pl-12 animate-fade-in">
                                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                                     <h4 className="text-xs font-bold text-eng-400 uppercase tracking-widest">Análisis de Precio Unitario (APU)</h4>
                                     <div className="text-xs text-slate-500">
                                       Rendimiento: 
                                       {isEditing ? (
                                         <input 
                                           className="ml-2 bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-slate-300 w-32"
                                           value={partida.apu.rendimiento}
                                           onChange={(e) => {
                                              const nD = {...data}; 
                                              nD.presupuesto[idx].apu.rendimiento = e.target.value; 
                                              setData(nD);
                                           }} 
                                         />
                                       ) : (
                                         <span className="text-slate-300 ml-2">{partida.apu.rendimiento}</span>
                                       )}
                                     </div>
                                  </div>

                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* APU Columns Helper */}
                                    {(['materiales', 'equipos', 'manoDeObra'] as const).map((cat) => (
                                      <div key={cat} className="space-y-2">
                                        <h5 className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 border-b border-slate-800 pb-1">
                                          {cat === 'materiales' && <Hammer className="w-3 h-3" />}
                                          {cat === 'equipos' && <Truck className="w-3 h-3" />}
                                          {cat === 'manoDeObra' && <HardHat className="w-3 h-3" />}
                                          {cat.replace(/([A-Z])/g, ' $1').trim()}
                                        </h5>
                                        
                                        <div className="space-y-1">
                                          {/* Table Header */}
                                          <div className="flex text-[10px] text-slate-600 px-1">
                                            <span className="flex-grow">Desc.</span>
                                            <span className="w-12 text-right">Cant.</span>
                                            <span className="w-14 text-right">Costo</span>
                                            <span className="w-14 text-right">Total</span>
                                          </div>

                                          {partida.apu[cat].map((item, i) => (
                                            <div key={i} className="flex items-center gap-2 text-xs p-1 hover:bg-slate-800/50 rounded group">
                                              <div className="flex-grow min-w-0">
                                                {isEditing ? (
                                                   <input 
                                                     value={item.descripcion}
                                                     onChange={(e) => handleAPUItemChange(idx, cat, i, 'descripcion', e.target.value)}
                                                     className="w-full bg-transparent border-b border-slate-700 focus:border-eng-500 outline-none text-slate-300"
                                                   />
                                                ) : (
                                                   <span className="text-slate-400 truncate block" title={item.descripcion}>{item.descripcion}</span>
                                                )}
                                              </div>
                                              
                                              <div className="w-12 text-right">
                                                {isEditing ? (
                                                   <input 
                                                     type="number"
                                                     value={item.cantidad}
                                                     onChange={(e) => handleAPUItemChange(idx, cat, i, 'cantidad', e.target.value)}
                                                     className="w-full bg-slate-800 border border-slate-700 rounded px-1 text-right text-[10px]"
                                                   />
                                                ) : (
                                                   <span className="text-slate-500">{item.cantidad}</span>
                                                )}
                                              </div>
                                              
                                              <div className="w-14 text-right">
                                                 {isEditing ? (
                                                   <input 
                                                     type="number"
                                                     value={item.costoUnitario}
                                                     onChange={(e) => handleAPUItemChange(idx, cat, i, 'costoUnitario', e.target.value)}
                                                     className="w-full bg-slate-800 border border-slate-700 rounded px-1 text-right text-[10px]"
                                                   />
                                                ) : (
                                                   <span className="text-slate-500">{item.costoUnitario.toFixed(2)}</span>
                                                )}
                                              </div>

                                              <div className="w-14 text-right font-mono text-slate-300">
                                                {item.total.toFixed(2)}
                                              </div>
                                            </div>
                                          ))}
                                          
                                          {/* Subtotal Category */}
                                          <div className="flex justify-between pt-2 border-t border-slate-800 mt-2">
                                            <span className="text-[10px] text-slate-500 uppercase">Subtotal</span>
                                            <span className="text-xs font-medium text-slate-300">
                                              ${partida.apu[cat].reduce((acc, curr) => acc + curr.total, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Indirect Costs & Total Summary */}
                                  <div className="mt-6 bg-slate-800 p-4 rounded-lg border border-slate-700 max-w-md ml-auto">
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-700 pb-2">Resumen de Costos (Unitario)</h5>
                                    
                                    <div className="space-y-2 text-sm">
                                      {(() => {
                                        const mat = partida.apu.materiales.reduce((acc, c) => acc + c.total, 0);
                                        const eq = partida.apu.equipos.reduce((acc, c) => acc + c.total, 0);
                                        const mo = partida.apu.manoDeObra.reduce((acc, c) => acc + c.total, 0);
                                        const cd = mat + eq + mo;
                                        const admin = cd * (partida.apu.administracionPorcentaje / 100);
                                        const subtotal = cd + admin;
                                        const utilidad = subtotal * (partida.apu.utilidadPorcentaje / 100);
                                        const final = subtotal + utilidad;

                                        return (
                                          <>
                                            <div className="flex justify-between text-slate-400">
                                              <span>Costo Directo</span>
                                              <span>${cd.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-slate-400">
                                              <span className="flex items-center gap-2">
                                                Gastos Admin. 
                                                {isEditing ? (
                                                  <div className="flex items-center">
                                                    <input 
                                                      type="number" 
                                                      className="w-10 bg-slate-900 border border-slate-600 rounded px-1 text-center text-xs mx-1"
                                                      value={partida.apu.administracionPorcentaje}
                                                      onChange={(e) => handleAPUMarkupChange(idx, 'administracionPorcentaje', e.target.value)}
                                                    />
                                                    %
                                                  </div>
                                                ) : (
                                                  <span className="text-xs bg-slate-700 px-1 rounded">({partida.apu.administracionPorcentaje}%)</span>
                                                )}
                                              </span>
                                              <span>${admin.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                            <div className="flex justify-between text-slate-500 text-xs pl-2 border-l-2 border-slate-700">
                                              <span>Subtotal</span>
                                              <span>${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-slate-400">
                                              <span className="flex items-center gap-2">
                                                Utilidad / Ganancia
                                                {isEditing ? (
                                                  <div className="flex items-center">
                                                    <input 
                                                      type="number" 
                                                      className="w-10 bg-slate-900 border border-slate-600 rounded px-1 text-center text-xs mx-1"
                                                      value={partida.apu.utilidadPorcentaje}
                                                      onChange={(e) => handleAPUMarkupChange(idx, 'utilidadPorcentaje', e.target.value)}
                                                    />
                                                    %
                                                  </div>
                                                ) : (
                                                  <span className="text-xs bg-slate-700 px-1 rounded">({partida.apu.utilidadPorcentaje}%)</span>
                                                )}
                                              </span>
                                              <span>${utilidad.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                            <div className="flex justify-between text-eng-300 font-bold border-t border-slate-600 pt-2 mt-2 text-base">
                                              <span>Precio Unitario Final</span>
                                              <span>${final.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-900 border-t border-slate-700">
                       <tr>
                         <td colSpan={5} className="px-4 py-3 text-right font-medium text-slate-400 text-xs tracking-wider border-b border-slate-800">COSTO DIRECTO TOTAL</td>
                         <td className="px-4 py-3 text-right font-medium text-slate-300 font-mono border-b border-slate-800">
                           ${totalPresupuesto.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                         </td>
                         <td className="border-b border-slate-800"></td>
                       </tr>
                       
                       {/* Footer Summary with Taxes and Advance */}
                       <tr>
                         <td colSpan={5} className="px-4 py-2 text-right font-medium text-slate-400 text-xs tracking-wider flex justify-end items-center gap-2">
                            <span>IVA</span>
                            {isEditing ? (
                              <div className="flex items-center bg-slate-800 rounded px-1">
                                <input 
                                   type="number"
                                   value={data.presupuestoConfig.porcentajeIVA}
                                   onChange={(e) => handleConfigChange('porcentajeIVA', e.target.value)}
                                   className="w-10 bg-transparent text-right text-xs outline-none text-slate-300"
                                />
                                <Percent className="w-3 h-3 text-slate-500 ml-1" />
                              </div>
                            ) : (
                              <span className="text-slate-500">({data.presupuestoConfig.porcentajeIVA}%)</span>
                            )}
                         </td>
                         <td className="px-4 py-2 text-right font-medium text-slate-300 font-mono">
                           ${montoIVA.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                         </td>
                         <td></td>
                       </tr>
                       
                       <tr>
                         <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-100 text-sm tracking-wider">TOTAL GENERAL</td>
                         <td className="px-4 py-3 text-right font-bold text-eng-400 font-mono text-lg">
                           ${totalGeneral.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                         </td>
                         <td></td>
                       </tr>

                       {/* Advance Payment Row */}
                       <tr className="bg-slate-800/30">
                         <td colSpan={5} className="px-4 py-2 text-right text-slate-400 text-xs flex justify-end items-center gap-2">
                            <span>ANTICIPO SUGERIDO</span>
                            {isEditing ? (
                              <div className="flex items-center bg-slate-800 rounded px-1 border border-slate-700">
                                <input 
                                   type="number"
                                   value={data.presupuestoConfig.porcentajeAnticipo}
                                   onChange={(e) => handleConfigChange('porcentajeAnticipo', e.target.value)}
                                   className="w-10 bg-transparent text-right text-xs outline-none text-slate-300"
                                />
                                <Percent className="w-3 h-3 text-slate-500 ml-1" />
                              </div>
                            ) : (
                              <span className="text-slate-500">({data.presupuestoConfig.porcentajeAnticipo}%)</span>
                            )}
                         </td>
                         <td className="px-4 py-2 text-right font-medium text-slate-300 font-mono text-sm border-t border-slate-700/50">
                           ${montoAnticipo.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                         </td>
                         <td></td>
                       </tr>

                    </tfoot>
                  </table>
                  
                  {/* Validity Info Footer */}
                  <div className="p-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-end text-xs text-slate-500 gap-4">
                    <div className="flex items-center gap-2">
                       <Calendar className="w-3 h-3" />
                       <span>Validez de la Oferta:</span>
                       {isEditing ? (
                         <div className="flex items-center">
                            <input 
                              type="number"
                              value={data.presupuestoConfig.diasValidez}
                              onChange={(e) => handleConfigChange('diasValidez', e.target.value)}
                              className="w-10 bg-slate-800 border border-slate-700 rounded px-1 text-center text-slate-300"
                            />
                            <span className="ml-1">días</span>
                         </div>
                       ) : (
                         <span className="text-slate-300">{data.presupuestoConfig.diasValidez} días</span>
                       )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart Side */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center h-fit sticky top-24">
                 <h3 className="text-sm font-semibold text-slate-200 mb-4 uppercase tracking-wider self-start">Distribución de Costos</h3>
                 <div className="w-full h-64">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie
                         data={costDistribution}
                         cx="50%"
                         cy="50%"
                         innerRadius={60}
                         outerRadius={80}
                         paddingAngle={5}
                         dataKey="value"
                         stroke="none"
                       >
                         {costDistribution.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                         ))}
                       </Pie>
                       <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px', color: '#f1f5f9' }}
                          formatter={(value: number) => `$${value.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
                       />
                       <Legend verticalAlign="bottom" height={36} iconType="circle" />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
                 
                 {/* Quick Stats */}
                 <div className="w-full mt-4 space-y-3 pt-4 border-t border-slate-700">
                    <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-400">Total Partidas</span>
                       <span className="text-slate-200 font-mono">{data.presupuesto.length}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                       <span className="text-slate-400">Impuesto (IVA)</span>
                       <span className="text-slate-200 font-mono">{data.presupuestoConfig.porcentajeIVA}%</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsDashboard;
