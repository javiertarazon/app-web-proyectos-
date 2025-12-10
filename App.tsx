import React, { useState } from 'react';
import InputSection from './components/InputSection';
import ClarificationChat from './components/ClarificationChat';
import ResultsDashboard from './components/ResultsDashboard';
import ProjectList from './components/ProjectList';
import SettingsPanel from './components/SettingsPanel';
import { generateClarifyingQuestions, generateEngineeringData, modifyEngineeringData } from './services/geminiService';
import { AppStatus, ProjectResponse, FileAttachment, ChatMessage } from './types';
import { Layers, Github, Settings as SettingsIcon, StopCircle } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.DASHBOARD);
  const [data, setData] = useState<ProjectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false);

  // --- Handlers ---

  const handleNewProject = () => {
    setStatus(AppStatus.INPUT);
    setData(null);
    setChatMessages([]);
    setAttachments([]);
    setIsReadyToGenerate(false);
  };

  const handleOpenProject = (project: ProjectResponse) => {
    setData(project);
    setStatus(AppStatus.SUCCESS);
  };

  const handleReturnToDashboard = () => {
    setStatus(AppStatus.DASHBOARD);
  };

  const handleOpenSettings = () => {
    setStatus(AppStatus.SETTINGS);
  };

  // --- Core Logic ---

  const handleInitialInput = async (description: string, files: FileAttachment[]) => {
    setStatus(AppStatus.CLARIFYING);
    setAttachments(files);
    setIsProcessing(true);
    setIsReadyToGenerate(false);
    
    const initialMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: description,
      timestamp: new Date()
    };
    
    const currentHistory = [initialMsg];
    setChatMessages(currentHistory);

    try {
      const response = await generateClarifyingQuestions(currentHistory, files);
      
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.message,
        timestamp: new Date(),
        clarificationData: response
      };
      
      setChatMessages(prev => [...prev, aiMsg]);
      setIsReadyToGenerate(response.isReady);

    } catch (err: any) {
      console.error(err);
      setError("No se pudo iniciar el asistente de clarificación.");
      setStatus(AppStatus.ERROR);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClarificationMessage = async (text: string) => {
    setIsProcessing(true);
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };
    
    const updatedHistory = [...chatMessages, userMsg];
    setChatMessages(updatedHistory);

    try {
       const response = await generateClarifyingQuestions(updatedHistory, attachments);
       
       const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.message,
        timestamp: new Date(),
        clarificationData: response
      };

      setChatMessages(prev => [...prev, aiMsg]);
      setIsReadyToGenerate(response.isReady);

    } catch (err: any) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateReport = async () => {
    setStatus(AppStatus.ANALYZING);
    try {
      const result = await generateEngineeringData(chatMessages, attachments);
      // If status changed (user clicked stop), don't update data
      setData(result);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
       // Only show error if we are still analyzing (not if stopped)
       if(status === AppStatus.ANALYZING) {
          console.error(err);
          setError(err.message || "Error generando el informe final.");
          setStatus(AppStatus.ERROR);
       }
    }
  };

  const handleStopGeneration = () => {
      // Logic to effectively "cancel" for the user: reset state.
      // Note: This does not abort the network request in this version, but resets UI.
      if (status === AppStatus.ANALYZING) {
          setStatus(AppStatus.DASHBOARD); // Or clarify, but Dashboard is safer to reset
      }
  };

  const handleModifyReport = async (request: string) => {
      if(!data) return;
      setIsModifying(true);
      try {
          const updatedData = await modifyEngineeringData(data, request);
          updatedData.id = data.id;
          updatedData.lastModified = new Date().toISOString();
          setData(updatedData);
      } catch (err: any) {
          // If the user cancelled, we might still be here depending on implementation, 
          // but we will rely on isModifying check in UI
          if (isModifying) {
              alert("Error aplicando cambios: " + err.message);
          }
      } finally {
          setIsModifying(false);
      }
  };

  const handleCancelModify = () => {
      setIsModifying(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-eng-500 selection:text-white">
      
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={handleReturnToDashboard}>
            <div className="bg-gradient-to-tr from-eng-600 to-indigo-600 p-2 rounded-lg">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">IngenI/O</h1>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Asistente Técnico AI</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
             <button 
               onClick={handleOpenSettings}
               className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
               title="Configuración"
             >
               <SettingsIcon className="w-5 h-5" />
             </button>
             <div className="hidden md:flex items-center gap-2">
                <span>v2.3</span>
                <a href="#" className="hover:text-white transition-colors"><Github className="w-5 h-5" /></a>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-8">

        {/* VIEW: DASHBOARD (HOME) */}
        {status === AppStatus.DASHBOARD && (
          <ProjectList onOpenProject={handleOpenProject} onNewProject={handleNewProject} />
        )}

        {/* VIEW: SETTINGS */}
        {status === AppStatus.SETTINGS && (
           <SettingsPanel onClose={handleReturnToDashboard} />
        )}
        
        {/* VIEW: INITIAL INPUT FORM */}
        {status === AppStatus.INPUT && (
          <>
            <div className="flex justify-start max-w-4xl mx-auto mb-4">
               <button 
                 onClick={handleReturnToDashboard}
                 className="text-slate-400 hover:text-white text-sm flex items-center gap-2 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-all"
               >
                 ← Volver al Dashboard
               </button>
            </div>
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-6 animate-fade-in-up mt-4">
                <h2 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-eng-400 via-indigo-400 to-purple-400">
                Cálculo de Ingeniería<br/>Potenciado por IA
                </h2>
                <p className="text-slate-400 max-w-2xl text-lg">
                Sube tus normas técnicas, describe el proyecto y colabora con un auditor IA para generar expedientes técnicos perfectos.
                </p>
            </div>
            <InputSection onAnalyze={handleInitialInput} isAnalyzing={false} />
          </>
        )}

        {/* VIEW: CLARIFICATION CHAT */}
        {status === AppStatus.CLARIFYING && (
            <ClarificationChat 
                messages={chatMessages} 
                onSendMessage={handleClarificationMessage}
                onGenerateReport={handleGenerateReport}
                isProcessing={isProcessing}
                isReadyToGenerate={isReadyToGenerate}
            />
        )}

        {/* VIEW: ANALYZING SPINNER */}
        {status === AppStatus.ANALYZING && (
           <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in relative">
               <div className="relative">
                   <div className="w-24 h-24 border-4 border-slate-700 border-t-eng-500 rounded-full animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                       <Layers className="w-8 h-8 text-eng-500 animate-pulse" />
                   </div>
               </div>
               <h3 className="mt-8 text-xl font-bold text-white">Generando Expediente Técnico...</h3>
               <p className="text-slate-400 mt-2 text-center max-w-md">Calculando cómputos métricos, APU y memoria descriptiva. <br/>Esto puede tardar unos minutos.</p>
               
               <button 
                onClick={handleStopGeneration}
                className="mt-8 flex items-center gap-2 bg-red-900/50 hover:bg-red-800 text-red-200 px-6 py-2 rounded-full font-medium transition-colors border border-red-800"
               >
                 <StopCircle className="w-5 h-5" />
                 Detener Generación
               </button>
           </div>
        )}

        {/* VIEW: ERROR */}
        {status === AppStatus.ERROR && (
          <div className="max-w-2xl mx-auto mt-8 bg-red-950/30 border border-red-900/50 p-6 rounded-xl text-center">
            <div className="inline-block p-3 bg-red-900/50 rounded-full mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-xl font-semibold text-red-200 mb-2">Error en el proceso</h3>
            <p className="text-red-300/80 mb-4">{error}</p>
            <button 
              onClick={() => setStatus(AppStatus.DASHBOARD)}
              className="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded-lg transition-colors text-sm font-medium"
            >
              Volver al Inicio
            </button>
          </div>
        )}

        {/* VIEW: SUCCESS DASHBOARD */}
        {status === AppStatus.SUCCESS && data && (
          <>
            <div className="flex justify-end max-w-7xl mx-auto mb-6">
               <button 
                 onClick={handleReturnToDashboard}
                 className="text-slate-400 hover:text-white text-sm flex items-center gap-2 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-all"
               >
                 ← Cerrar Proyecto
               </button>
            </div>
            <ResultsDashboard 
                data={data} 
                onModify={handleModifyReport} 
                onCancelModify={handleCancelModify}
                isModifying={isModifying} 
            />
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