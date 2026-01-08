import React, { useState, useEffect } from 'react';
import { AppSettings, CountryCode, Discipline, Standard, FileAttachment } from '../types';
import { SUPPORTED_COUNTRIES, DISCIPLINES_LIST, STANDARDS_DB } from '../data/standardsData';
import { LLS_ELECTRIC_CATALOG } from '../data/materialsCatalogs';
import { saveSettings, loadSettings, addCustomStandard, removeCustomStandard } from '../services/settingsService';
import { Settings, Globe, Book, FileText, Upload, X, Check, Search, Download, ShoppingBag } from 'lucide-react';

interface SettingsPanelProps {
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [activeTab, setActiveTab] = useState<'general' | 'library' | 'files'>('general');
  const [selectedLibraryDiscipline, setSelectedLibraryDiscipline] = useState<Discipline>('CIVIL');

  const handleCountryChange = (code: CountryCode) => {
    const newSettings = { ...settings, country: code };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "text/plain" || file.type === "application/pdf") {
         const reader = new FileReader();
         reader.onload = (event) => {
           const base64String = (event.target?.result as string).split(',')[1];
           const attachment: FileAttachment = {
             name: file.name,
             mimeType: file.type,
             data: base64String
           };
           const updated = addCustomStandard(attachment);
           setSettings(updated);
         };
         reader.readAsDataURL(file);
      } else {
        alert("Solo se permiten archivos de texto (.txt) o PDF para las normas personalizadas.");
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    const updated = removeCustomStandard(index);
    setSettings(updated);
  };

  // Helper to get active standards list for display
  const currentStandards = STANDARDS_DB[settings.country][selectedLibraryDiscipline] || [];

  return (
    <div className="w-full max-w-5xl mx-auto p-4 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            <Settings className="w-8 h-8 text-eng-500" />
            Configuración
          </h2>
          <p className="text-slate-400 text-sm">Personaliza las normativas, país y bases de conocimiento.</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 min-h-[60vh]">
        
        {/* Sidebar Tabs */}
        <div className="md:col-span-1 space-y-2">
          <button 
            onClick={() => setActiveTab('general')}
            className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'general' ? 'bg-eng-600 text-white shadow-lg shadow-eng-900/50' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Globe className="w-5 h-5" />
            General
          </button>
          <button 
            onClick={() => setActiveTab('library')}
            className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'library' ? 'bg-eng-600 text-white shadow-lg shadow-eng-900/50' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Book className="w-5 h-5" />
            Biblioteca Normas
          </button>
          <button 
            onClick={() => setActiveTab('files')}
            className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${activeTab === 'files' ? 'bg-eng-600 text-white shadow-lg shadow-eng-900/50' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Upload className="w-5 h-5" />
            Mis Archivos
          </button>
        </div>

        {/* Content Area */}
        <div className="md:col-span-3 bg-slate-800/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm">
          
          {/* TAB: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-8 animate-fade-in">
               <div>
                 <label className="block text-sm font-bold text-slate-300 mb-3">País de Referencia</label>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {SUPPORTED_COUNTRIES.map((c) => (
                     <button
                       key={c.code}
                       onClick={() => handleCountryChange(c.code)}
                       className={`flex items-center justify-between p-4 rounded-xl border transition-all ${settings.country === c.code ? 'bg-eng-900/30 border-eng-500 text-white ring-1 ring-eng-500' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                     >
                       <span className="font-medium">{c.name}</span>
                       {settings.country === c.code && <Check className="w-5 h-5 text-eng-400" />}
                     </button>
                   ))}
                 </div>
                 <p className="mt-3 text-xs text-slate-500">
                   * Al cambiar el país, la IA utilizará automáticamente las leyes y códigos constructivos predeterminados de esa región para futuros proyectos.
                 </p>
               </div>
            </div>
          )}

          {/* TAB: LIBRARY */}
          {activeTab === 'library' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <h3 className="font-bold text-white text-lg">Catálogo de Normas: {SUPPORTED_COUNTRIES.find(c => c.code === settings.country)?.name}</h3>
                 <select 
                   value={selectedLibraryDiscipline} 
                   onChange={(e) => setSelectedLibraryDiscipline(e.target.value as Discipline)}
                   className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-eng-500 outline-none"
                 >
                   {DISCIPLINES_LIST.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                 </select>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {currentStandards.length > 0 ? currentStandards.map((std, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex justify-between items-center group hover:border-slate-600 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-slate-800 text-eng-400 text-xs font-mono px-2 py-0.5 rounded border border-slate-700">{std.code}</span>
                        {std.active && <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full border border-green-900/50">Activa</span>}
                      </div>
                      <h4 className="text-slate-200 font-medium text-sm">{std.title}</h4>
                    </div>
                    <a 
                      href={`https://www.google.com/search?q=${encodeURIComponent(std.code + " " + std.title + " pdf")}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-slate-800 text-slate-400 hover:text-white hover:bg-eng-600 rounded-lg transition-colors tooltip"
                      title="Buscar y Descargar Norma"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                )) : (
                  <div className="text-center py-10 text-slate-500 italic">No hay normas registradas para esta disciplina en este país.</div>
                )}
              </div>

              {/* SECTION FOR ACTIVE CATALOGS */}
              <div className="mt-8 border-t border-slate-700 pt-6">
                <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-orange-500" />
                  Catálogos de Proveedores Activos
                </h3>
                <div className="bg-orange-950/20 border border-orange-900/50 p-4 rounded-xl">
                    <div className="flex items-start justify-between">
                        <div>
                            <h4 className="text-orange-200 font-bold text-sm">{LLS_ELECTRIC_CATALOG.name}</h4>
                            <p className="text-xs text-orange-200/70 mt-1">{LLS_ELECTRIC_CATALOG.description}</p>
                            <a href={LLS_ELECTRIC_CATALOG.url} target="_blank" className="text-[10px] text-blue-400 hover:underline mt-2 block">Ver Fuente Original</a>
                        </div>
                        <span className="bg-orange-900 text-orange-200 text-[10px] px-2 py-1 rounded-full uppercase font-bold tracking-wider">Integrado</span>
                    </div>
                    <div className="mt-3 text-xs text-slate-400 grid grid-cols-2 gap-2">
                        {LLS_ELECTRIC_CATALOG.products.slice(0, 4).map((p, i) => (
                           <div key={i} className="bg-slate-900/50 p-1.5 rounded border border-slate-700/50 truncate">
                              - {p.name}
                           </div>
                        ))}
                        {LLS_ELECTRIC_CATALOG.products.length > 4 && <div className="text-slate-500 italic pl-2">+ {LLS_ELECTRIC_CATALOG.products.length - 4} items más...</div>}
                    </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FILES */}
          {activeTab === 'files' && (
             <div className="space-y-6 animate-fade-in">
                <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center bg-slate-900/30 hover:bg-slate-900/50 transition-colors">
                  <div className="flex justify-center mb-4">
                    <div className="bg-eng-600/20 p-3 rounded-full">
                       <Upload className="w-8 h-8 text-eng-500" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Cargar Documentos Legales o Técnicos</h3>
                  <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
                    Sube archivos PDF o TXT con ordenanzas municipales, leyes específicas o guías internas. La IA los usará como contexto prioritario.
                  </p>
                  
                  <label className="bg-eng-600 hover:bg-eng-500 text-white px-6 py-2.5 rounded-lg cursor-pointer font-medium transition-colors shadow-lg shadow-eng-900/30">
                    Seleccionar Archivo
                    <input type="file" onChange={handleFileUpload} className="hidden" accept=".txt,.pdf" />
                  </label>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Mis Archivos ({settings.customStandards.length})</h4>
                  {settings.customStandards.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-900 border border-slate-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-eng-500" />
                        <div>
                           <p className="text-sm text-slate-200 font-medium truncate max-w-[200px] sm:max-w-xs">{file.name}</p>
                           <span className="text-[10px] text-slate-500 uppercase">{file.mimeType.split('/')[1]}</span>
                        </div>
                      </div>
                      <button onClick={() => handleRemoveFile(idx)} className="text-slate-500 hover:text-red-400 p-2">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {settings.customStandards.length === 0 && (
                    <div className="text-center text-slate-500 text-xs py-4">No has subido archivos personalizados.</div>
                  )}
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;