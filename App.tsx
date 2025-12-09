import React, { useState } from 'react';
import InputSection from './components/InputSection';
import ResultsDashboard from './components/ResultsDashboard';
import { generateEngineeringData } from './services/geminiService';
import { AppStatus, ProjectResponse, FileAttachment } from './types';
import { Layers, Github } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [data, setData] = useState<ProjectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (description: string, files: FileAttachment[]) => {
    setStatus(AppStatus.ANALYZING);
    setError(null);
    setData(null);

    try {
      const result = await generateEngineeringData(description, files);
      setData(result);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error inesperado durante el cálculo.");
      setStatus(AppStatus.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-eng-500 selection:text-white">
      
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-eng-600 to-indigo-600 p-2 rounded-lg">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">IngenI/O</h1>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Asistente Técnico AI</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4 text-sm text-slate-400">
             <span>v1.0.1 Pro</span>
             <a href="#" className="hover:text-white transition-colors"><Github className="w-5 h-5" /></a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-8">
        {status === AppStatus.IDLE && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-fade-in-up">
            <h2 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-eng-400 via-indigo-400 to-purple-400">
              Cálculo de Ingeniería<br/>Potenciado por IA
            </h2>
            <p className="text-slate-400 max-w-2xl text-lg">
              Sube tus normas técnicas, describe el proyecto y genera expedientes técnicos completos, editables y descargables.
            </p>
          </div>
        )}

        <div className={status === AppStatus.SUCCESS ? "mt-8" : "mt-0"}>
          {status !== AppStatus.SUCCESS && (
            <InputSection onAnalyze={handleAnalyze} isAnalyzing={status === AppStatus.ANALYZING} />
          )}
        </div>

        {status === AppStatus.ERROR && (
          <div className="max-w-2xl mx-auto mt-8 bg-red-950/30 border border-red-900/50 p-6 rounded-xl text-center">
            <div className="inline-block p-3 bg-red-900/50 rounded-full mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-xl font-semibold text-red-200 mb-2">Error en el análisis</h3>
            <p className="text-red-300/80 mb-4">{error}</p>
            <button 
              onClick={() => setStatus(AppStatus.IDLE)}
              className="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded-lg transition-colors text-sm font-medium"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {status === AppStatus.SUCCESS && data && (
          <>
            <div className="flex justify-end max-w-7xl mx-auto mb-6">
               <button 
                 onClick={() => setStatus(AppStatus.IDLE)}
                 className="text-slate-400 hover:text-white text-sm flex items-center gap-2 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-all"
               >
                 ← Nuevo Cálculo
               </button>
            </div>
            <ResultsDashboard data={data} />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 text-center text-slate-600 text-sm">
        <p>Generado con Gemini 3 Pro • Los resultados deben ser verificados por un ingeniero profesional certificado.</p>
      </footer>
    </div>
  );
};

export default App;
