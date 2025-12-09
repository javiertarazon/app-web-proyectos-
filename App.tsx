import React, { useState } from 'react';
import InputSection from './components/InputSection';
import ClarificationChat from './components/ClarificationChat';
import ResultsDashboard from './components/ResultsDashboard';
import { generateClarifyingQuestions, generateEngineeringData, modifyEngineeringData } from './services/geminiService';
import { AppStatus, ProjectResponse, FileAttachment, ChatMessage } from './types';
import { Layers, Github } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [data, setData] = useState<ProjectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false);

  // 1. Initial Input -> Start Clarification
  const handleInitialInput = async (description: string, files: FileAttachment[]) => {
    setStatus(AppStatus.CLARIFYING);
    setAttachments(files);
    setIsProcessing(true);
    setIsReadyToGenerate(false);
    
    // Add User's initial prompt to chat history
    const initialMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: description,
      timestamp: new Date()
    };
    
    // Create temp history for the API call
    const currentHistory = [initialMsg];
    setChatMessages(currentHistory);

    try {
      const response = await generateClarifyingQuestions(currentHistory, files);
      
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.message, // Fallback text for history view
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

  // 2. Chat during Clarification Phase (Cycle)
  const handleClarificationMessage = async (text: string) => {
    setIsProcessing(true);
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: new Date()
    };
    
    // Optimistic update
    const updatedHistory = [...chatMessages, userMsg];
    setChatMessages(updatedHistory);

    try {
       // Call AI with updated history to check answer or get next questions
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
      // Don't crash app, just let user try again or generate
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Generate Final Report
  const handleGenerateReport = async () => {
    setStatus(AppStatus.ANALYZING);
    try {
      const result = await generateEngineeringData(chatMessages, attachments);
      setData(result);
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
       console.error(err);
       setError(err.message || "Error generando el informe final.");
       setStatus(AppStatus.ERROR);
    }
  };

  // 4. Modify Report via Chat
  const handleModifyReport = async (request: string) => {
      if(!data) return;
      setIsModifying(true);
      try {
          const updatedData = await modifyEngineeringData(data, request);
          setData(updatedData);
      } catch (err: any) {
          alert("Error aplicando cambios: " + err.message);
      } finally {
          setIsModifying(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-eng-500 selection:text-white">
      
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setStatus(AppStatus.IDLE)}>
            <div className="bg-gradient-to-tr from-eng-600 to-indigo-600 p-2 rounded-lg">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">IngenI/O</h1>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Asistente Técnico AI</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4 text-sm text-slate-400">
             <span>v2.0 - Interactivo</span>
             <a href="#" className="hover:text-white transition-colors"><Github className="w-5 h-5" /></a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-8">
        
        {/* VIEW: INITIAL INPUT */}
        {status === AppStatus.IDLE && (
          <>
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-6 animate-fade-in-up mt-10">
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
           <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
               <div className="relative">
                   <div className="w-24 h-24 border-4 border-slate-700 border-t-eng-500 rounded-full animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                       <Layers className="w-8 h-8 text-eng-500 animate-pulse" />
                   </div>
               </div>
               <h3 className="mt-8 text-xl font-bold text-white">Generando Expediente Técnico...</h3>
               <p className="text-slate-400 mt-2">Calculando cómputos métricos, APU y memoria descriptiva.</p>
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
              onClick={() => setStatus(AppStatus.IDLE)}
              className="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded-lg transition-colors text-sm font-medium"
            >
              Reiniciar
            </button>
          </div>
        )}

        {/* VIEW: SUCCESS DASHBOARD */}
        {status === AppStatus.SUCCESS && data && (
          <>
            <div className="flex justify-end max-w-7xl mx-auto mb-6">
               <button 
                 onClick={() => setStatus(AppStatus.IDLE)}
                 className="text-slate-400 hover:text-white text-sm flex items-center gap-2 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-all"
               >
                 ← Nuevo Proyecto
               </button>
            </div>
            <ResultsDashboard data={data} onModify={handleModifyReport} isModifying={isModifying} />
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