import React, { useState, useEffect, useRef } from 'react';
import { ProjectResponse, Partida, APUItem, PresupuestoConfig, APU } from '../types';
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
  Percent,
  Sliders,
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
  Loader2
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

const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ data: initialData, onModify, isModifying }) => {
  const [data, setData] = useState<ProjectResponse>(initialData);
  const [activeTab, setActiveTab] = useState<'memoria' | 'calculos' | 'presupuesto' | 'apu'>('memoria');
  // En la tab APU, usamos expandedRow para saber cual APU está abierto
  const [expandedApuIndex, setExpandedApuIndex] = useState<number | null>(0);
  const [isEditing, setIsEditing] = useState(false);
  const [apuSearchTerm, setApuSearchTerm] = useState('');
  
  // Chat Modification State
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync state if initialData changes (new search or modification)
  useEffect(() => {
    // Normalización de datos para compatibilidad con versiones anteriores de la API
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

  const handleModificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && !isModifying) {
      await onModify(chatInput);
      setChatInput('');
    }
  };

  // --- LÓGICA DE CÁLCULO APU (Estilo Lulo Software) ---

  const recalculatePartida = (partida: Partida): Partida => {
    
    // 1. MATERIALES: Cantidad * Costo * (1 + %Desperdicio)
    const calculateMaterialTotal = (item: APUItem) => {
        const wasteFactor = 1 + ((item.desperdicio || 0) / 100);
        return item.cantidad * item.costoUnitario * wasteFactor;
    };
    const totalMateriales = partida.apu.materiales.reduce((acc, item) => acc + calculateMaterialTotal(item), 0);

    // 2. EQUIPOS: Cantidad * Costo
    const calculateSimpleTotal = (item: APUItem) => item.cantidad * item.costoUnitario;
    const totalEquipos = partida.apu.equipos.reduce((acc, item) => acc + calculateSimpleTotal(item), 0);

    // 3. MANO DE OBRA (Cálculo Venezolano)
    // Base Labor cost (Jornales Básicos)
    const totalLaborBase = partida.apu.manoDeObra.reduce((acc, item) => acc + calculateSimpleTotal(item), 0);
    // Prestaciones Sociales (CAS) sobre el salario base
    const montoCAS = totalLaborBase * (partida.apu.laborCASPorcentaje / 100);
    // Bono Alimentación (Cesta Ticket)
    // Se asume que la sumatoria de "cantidad" en mano de obra equivale al número de hombres/día requeridos por unidad de obra.
    const totalHombresDia = partida.apu.manoDeObra.reduce((acc, item) => acc + item.cantidad, 0);
    const montoBono = totalHombresDia * partida.apu.laborCestaTicket;
    
    const totalManoDeObra = totalLaborBase + montoCAS + montoBono;
    
    // 4. COSTO DIRECTO (A)
    const costoDirecto = totalMateriales + totalEquipos + totalManoDeObra;

    // 5. INDIRECTOS
    // Administración (sobre CD)
    const adminMonto = costoDirecto * (partida.apu.administracionPorcentaje / 100);
    const subtotalB = costoDirecto + adminMonto;
    
    // Utilidad (sobre Subtotal B)
    const utilidadMonto = subtotalB * (partida.apu.utilidadPorcentaje / 100);
    const precioUnitarioPrevio = subtotalB + utilidadMonto;

    // 6. FACTOR DE AJUSTE (Contingencia o Ajuste Final)
    // Aplicado sobre el precio unitario previo al IVA
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

  // --- Handlers ---

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

  // --- Export Markdown ---
  const downloadMemoriaMarkdown = () => {
    let md = `# ${data.projectTitle}\n\n`;
    md += `**Disciplina:** ${data.discipline}\n\n`;
    md += `## 1. Memoria Descriptiva\n\n`;
    md += `### Introducción\n${data.memoriaDescriptiva.introduccion}\n\n`;
    md += `### Descripción del Proyecto\n${data.memoriaDescriptiva.descripcionProyecto}\n\n`;
    
    downloadFile(md, `Memoria_${data.projectTitle.substring(0, 10)}.md`, 'text/markdown');
  };

  // --- Export CSV ---
  const downloadBudgetCSV = () => {
    let csv = "Codigo,Descripcion,Unidad,Metrado,P. Unitario,Total\n";
    data.presupuesto.forEach(p => {
        csv += `${p.codigo},"${p.descripcion}",${p.unidad},${p.metrado},${p.precioUnitario},${p.precioTotal}\n`;
    });
    downloadFile(csv, 'presupuesto.csv', 'text/csv');
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
                 
                 <div className="flex-grow p-4 overflow-y-auto bg-slate-950/80 text-sm text-slate-300">
                     <p className="mb-4">Describe los cambios que deseas realizar. La IA actualizará el proyecto completo (Memoria, Cálculos y Presupuesto).</p>
                     
                     <div className="bg-slate-800 p-3 rounded-lg mb-2 border border-slate-700">
                        <span className="font-bold text-xs text-eng-400 block mb-1">Ejemplos:</span>
                        <ul className="list-disc pl-4 space-y-1 text-xs text-slate-400">
                            <li>"Cambia el rendimiento del concreto a 20 m3/día"</li>
                            <li>"Agrega una partida de pintura epóxica"</li>
                            <li>"Actualiza el IVA al 16%"</li>
                            <li>"Elimina la partida de excavación manual"</li>
                        </ul>
                     </div>

                     {isModifying && (
                        <div className="flex items-center gap-2 text-eng-400 justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Aplicando cambios...</span>
                        </div>
                     )}
                 </div>

                 <form onSubmit={handleModificationSubmit} className="p-3 bg-slate-800 border-t border-slate-700">
                    <div className="relative">
                        <textarea 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Escribe tu solicitud..."
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2 pl-3 pr-10 text-xs text-white resize-none focus:ring-1 focus:ring-eng-500 outline-none"
                            rows={2}
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
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{data.projectTitle}</h1>
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
             <div className="flex items-center gap-1">
               <button onClick={downloadMemoriaMarkdown} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded tooltip" title="Descargar Memoria">
                 <FileType className="w-4 h-4" />
               </button>
               <button onClick={downloadBudgetCSV} className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded" title="Descargar Presupuesto">
                 <FileSpreadsheet className="w-4 h-4" />
               </button>
             </div>
          </div>
        </div>

        <div className="flex border-b border-slate-700 space-x-1 overflow-x-auto">
          <button onClick={() => setActiveTab('memoria')} className={`px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'memoria' ? 'border-eng-500 text-eng-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}>
            <FileText className="w-4 h-4" /> Memoria
          </button>
          <button onClick={() => setActiveTab('calculos')} className={`px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'calculos' ? 'border-eng-500 text-eng-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}>
            <Calculator className="w-4 h-4" /> Cálculos
          </button>
          <button onClick={() => setActiveTab('presupuesto')} className={`px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'presupuesto' ? 'border-eng-500 text-eng-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}>
            <DollarSign className="w-4 h-4" /> Presupuesto
          </button>
          <button onClick={() => setActiveTab('apu')} className={`px-4 py-3 text-sm font-medium flex items-center gap-2 transition-colors border-b-2 whitespace-nowrap ${activeTab === 'apu' ? 'border-eng-500 text-eng-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'}`}>
            <Layers className="w-4 h-4" /> Análisis de Precios (APU)
          </button>
        </div>
      </div>

      <div className="min-h-[500px]">
        {/* --- TAB MEMORIA (Rediseñada) --- */}
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
                          <h3 className="text-xl font-bold text-white">2. Descripción del Proyecto</h3>
                       </div>
                       <div className="text-slate-300 leading-relaxed whitespace-pre-line text-justify mb-6">
                           {data.memoriaDescriptiva.descripcionProyecto}
                       </div>
                       
                       {data.memoriaDescriptiva.descripcionEstructural && (
                         <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                             <h4 className="font-semibold text-slate-200 mb-2 text-sm uppercase">Sistema {data.discipline === 'ELECTRICA' ? 'Eléctrico' : 'Estructural'}</h4>
                             <p className="text-sm text-slate-400">{data.memoriaDescriptiva.descripcionEstructural}</p>
                         </div>
                       )}
                  </div>

                  {/* Servicios y Etapas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                          <div className="flex items-center gap-2 mb-4 text-eng-400">
                              <Zap className="w-5 h-5" />
                              <h3 className="font-bold text-white">Servicios Requeridos</h3>
                          </div>
                          <p className="text-sm text-slate-300">{data.memoriaDescriptiva.serviciosRequeridos}</p>
                      </div>

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
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* --- TAB CALCULOS --- */}
        {activeTab === 'calculos' && (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.memoriaCalculo.map((calc, idx) => (
                   <CalculationCard key={idx} item={calc} />
              ))}
            </div>
        )}

        {/* --- TAB PRESUPUESTO (RESUMEN) --- */}
        {activeTab === 'presupuesto' && (
          <div className="animate-fade-in space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* TABLA PRINCIPAL */}
              <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-4">
                   <h2 className="text-lg font-bold text-white flex items-center gap-2"><DollarSign className="w-5 h-5 text-eng-500" /> Presupuesto General</h2>
                </div>
                <div className="overflow-x-auto flex-grow">
                  <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                      <tr>
                        <th className="px-4 py-3">Código</th>
                        <th className="px-4 py-3">Partida</th>
                        <th className="px-4 py-3 text-right">Cant.</th>
                        <th className="px-4 py-3 text-right">P. Unitario</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {data.presupuesto.map((partida, idx) => (
                        <tr key={partida.codigo} className="hover:bg-slate-700/30 transition-colors">
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
                                onChange={(e) => handleBudgetChange(idx, 'metrado', e.target.value)} 
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
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-900 border-t border-slate-700">
                         <tr>
                            <td colSpan={3} className="px-4 py-3 text-right font-medium text-slate-400">SUBTOTAL GENERAL</td>
                            <td className="px-4 py-3 text-right font-mono text-slate-300">${totalPresupuesto.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td></td>
                         </tr>
                         <tr>
                            <td colSpan={3} className="px-4 py-3 text-right font-medium text-slate-400 flex items-center justify-end gap-2">
                                IVA 
                                {isEditing ? <input className="w-12 bg-slate-800 text-right border border-slate-600 rounded px-1 text-white" value={data.presupuestoConfig.porcentajeIVA} onChange={(e)=>handleConfigChange('porcentajeIVA', e.target.value)} /> : `(${data.presupuestoConfig.porcentajeIVA}%)`}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-300">${montoIVA.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            <td></td>
                         </tr>
                         <tr>
                            <td colSpan={3} className="px-4 py-3 text-right font-bold text-white text-lg">TOTAL PRESUPUESTO</td>
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
                                                    className="w-24 border border-slate-400 px-2 py-0.5 bg-white text-slate-900 font-bold" 
                                                    type="number" 
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
                                                                  <input className="w-full text-right border border-gray-300 bg-white text-slate-900 px-1 focus:bg-yellow-50" type="number" value={m.cantidad} onChange={(e) => handleAPUItemChange(originalIndex, 'materiales', i, 'cantidad', e.target.value)}/>
                                                              </td>
                                                              <td className="text-right p-1">
                                                                  <input className="w-full text-right border border-gray-300 bg-white text-slate-900 px-1 focus:bg-yellow-50" type="number" value={m.desperdicio} onChange={(e) => handleAPUItemChange(originalIndex, 'materiales', i, 'desperdicio', e.target.value)}/>
                                                              </td>
                                                              <td className="text-right p-1">
                                                                  <input className="w-full text-right border border-gray-300 bg-white text-slate-900 px-1 focus:bg-yellow-50" type="number" value={m.costoUnitario} onChange={(e) => handleAPUItemChange(originalIndex, 'materiales', i, 'costoUnitario', e.target.value)}/>
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
                                                                  <input className="w-full text-right border border-gray-300 bg-white text-slate-900 px-1 focus:bg-yellow-50" type="number" value={m.cantidad} onChange={(e) => handleAPUItemChange(originalIndex, 'equipos', i, 'cantidad', e.target.value)}/>
                                                              </td>
                                                              <td className="text-right p-1">
                                                                  <input className="w-full text-right border border-gray-300 bg-white text-slate-900 px-1 focus:bg-yellow-50" type="number" value={m.costoUnitario} onChange={(e) => handleAPUItemChange(originalIndex, 'equipos', i, 'costoUnitario', e.target.value)}/>
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
                                                                  <input className="w-full text-right border border-gray-300 bg-white text-slate-900 px-1 focus:bg-yellow-50" type="number" value={m.cantidad} onChange={(e) => handleAPUItemChange(originalIndex, 'manoDeObra', i, 'cantidad', e.target.value)}/>
                                                              </td>
                                                              <td className="text-right p-1">
                                                                  <input className="w-full text-right border border-gray-300 bg-white text-slate-900 px-1 focus:bg-yellow-50" type="number" value={m.costoUnitario} onChange={(e) => handleAPUItemChange(originalIndex, 'manoDeObra', i, 'costoUnitario', e.target.value)}/>
                                                              </td>
                                                              <td className="text-right p-1 px-2 font-bold">{m.total.toFixed(2)}</td>
                                                          </tr>
                                                      ))}
                                                  </tbody>
                                              </table>
                                              
                                              {/* Footer Mano de Obra (Calculos Laborales) */}
                                              <div className="bg-slate-50 p-3 border-t border-slate-300 space-y-2 text-slate-900">
                                                  <div className="flex justify-between border-b border-slate-200 pb-1">
                                                      <span>Subtotal Mano de Obra (Base):</span>
                                                      <span>{partida.apu.manoDeObra.reduce((a,b)=>a+b.total,0).toFixed(2)}</span>
                                                  </div>
                                                  
                                                  {/* CAS - Prestaciones Sociales */}
                                                  <div className="flex justify-between items-center text-slate-700 bg-yellow-50/50 p-1 rounded">
                                                      <span className="flex items-center gap-2 font-semibold">
                                                          Prestaciones Sociales (CAS) %
                                                          <input 
                                                            className="w-16 text-right border border-slate-300 bg-white text-slate-900 font-bold px-1 focus:ring-1 focus:ring-eng-500" 
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
                                                            className="w-16 text-right border border-slate-300 bg-white text-slate-900 font-bold px-1 focus:ring-1 focus:ring-eng-500" 
                                                            value={partida.apu.laborCestaTicket} 
                                                            onChange={(e)=>handleAPUGlobalChange(originalIndex, 'laborCestaTicket', e.target.value, 'number')} 
                                                          />
                                                      </span>
                                                      <span className="font-mono">
                                                          {(partida.apu.manoDeObra.reduce((a,b)=>a+b.cantidad,0) * partida.apu.laborCestaTicket).toFixed(2)}
                                                      </span>
                                                  </div>

                                                  <div className="flex justify-between font-bold border-t border-slate-300 pt-2 text-slate-900 text-sm">
                                                      <span>Total Mano de Obra + Beneficios:</span>
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
                                                  const moBase = partida.apu.manoDeObra.reduce((acc, c) => acc + c.total, 0);
                                                  const cas = moBase * (partida.apu.laborCASPorcentaje / 100);
                                                  const bono = partida.apu.manoDeObra.reduce((acc,c) => acc+c.cantidad,0) * partida.apu.laborCestaTicket;
                                                  const moTotal = moBase + cas + bono;
                                                  
                                                  const cd = mat + eq + moTotal;
                                                  const admin = cd * (partida.apu.administracionPorcentaje / 100);
                                                  const subtotal = cd + admin;
                                                  const utilidad = subtotal * (partida.apu.utilidadPorcentaje / 100);
                                                  const precioPrevio = subtotal + utilidad;
                                                  const ajuste = precioPrevio * ((partida.factorAjuste || 0) / 100);
                                                  const precioFinal = precioPrevio + ajuste;

                                                  return (
                                                      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right font-mono text-slate-900 text-sm">
                                                          <div className="text-slate-600 self-center">Costo Directo Unitario:</div>
                                                          <div className="font-bold text-base bg-white border border-slate-200 p-1">{cd.toFixed(2)}</div>
                                                          
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