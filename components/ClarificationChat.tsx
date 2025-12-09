import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, FileAttachment } from '../types';
import { Send, Bot, User, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';

interface ClarificationChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onGenerateReport: () => void;
  isProcessing: boolean;
  isReadyToGenerate: boolean; // Prop para saber si mostrar el botón principal
}

const ClarificationChat: React.FC<ClarificationChatProps> = ({ messages, onSendMessage, onGenerateReport, isProcessing, isReadyToGenerate }) => {
  const [input, setInput] = useState('');
  // Estado para manejar las respuestas de selección múltiple actuales
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Reset selected options when a new model message arrives
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'model') {
       setSelectedOptions({});
    }
  }, [messages.length]);

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleOptionSelect = (questionId: string, option: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [questionId]: option
    }));
  };

  const handleSubmitSelections = () => {
    // Convertir selecciones a texto
    const formattedResponses = Object.entries(selectedOptions).map(([qId, answer]) => {
      // Find the question text for context (optional, but good for the AI)
      // We scan the last message to find the question text corresponding to the ID
      let qText = "Pregunta";
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.clarificationData) {
         const q = lastMsg.clarificationData.questions.find(q => q.id === qId);
         if(q) qText = q.text;
      }
      return `Respuesta a "${qText}": ${answer}`;
    }).join('\n');

    if (formattedResponses && !isProcessing) {
      onSendMessage(formattedResponses);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const showOptionsForm = lastMessage?.role === 'model' && lastMessage.clarificationData?.questions && lastMessage.clarificationData.questions.length > 0;
  const isFormComplete = showOptionsForm && lastMessage.clarificationData?.questions.every(q => selectedOptions[q.id]);

  return (
    <div className="w-full max-w-4xl mx-auto h-[75vh] flex flex-col bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl animate-fade-in relative">
      {/* Header */}
      <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="bg-eng-600 p-2 rounded-lg">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm">Ingeniero Auditor IA</h2>
            <p className="text-slate-400 text-xs">
              {isReadyToGenerate ? "Información completa. Listo para procesar." : "Analizando requerimientos..."}
            </p>
          </div>
        </div>
        
        {isReadyToGenerate && (
          <button 
            onClick={onGenerateReport}
            className="animate-pulse bg-green-600 hover:bg-green-500 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-green-900/50 flex items-center gap-2 border border-green-400"
          >
            <span>Generar Informe Final</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-950/50 pb-32" ref={scrollRef}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-eng-600'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
              
              <div className={`space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                {/* Texto del mensaje */}
                <div className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 rounded-tr-none' 
                    : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none shadow-md'
                }`}>
                  {msg.role === 'model' && msg.clarificationData ? msg.clarificationData.message : msg.text}
                </div>

                {/* Preguntas de Selección (Solo para el último mensaje si es del modelo, o si queremos mostrar historial de que se preguntó) */}
                {/* Mostramos el formulario interactivo SOLO si es el último mensaje. Si es histórico, solo mostramos las preguntas sin interacción (opcional, por ahora solo interactivo al final) */}
                {msg.id === lastMessage?.id && msg.clarificationData?.questions && msg.clarificationData.questions.length > 0 && (
                   <div className="bg-slate-800/80 border border-slate-600 p-4 rounded-xl space-y-4 w-full animate-fade-in-up">
                      <h4 className="text-xs font-bold text-eng-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                         <CheckCircle2 className="w-3 h-3" /> Seleccione las opciones técnicas:
                      </h4>
                      {msg.clarificationData.questions.map((q) => (
                        <div key={q.id} className="space-y-2">
                           <p className="text-sm font-medium text-white">{q.text}</p>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {q.options.map((option) => (
                                 <button
                                    key={option}
                                    onClick={() => handleOptionSelect(q.id, option)}
                                    className={`text-left text-xs p-2.5 rounded-lg border transition-all flex items-center gap-2 ${
                                       selectedOptions[q.id] === option 
                                       ? 'bg-eng-600 border-eng-500 text-white shadow-md' 
                                       : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-500'
                                    }`}
                                 >
                                    <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${selectedOptions[q.id] === option ? 'border-white bg-white' : 'border-slate-500'}`}>
                                       {selectedOptions[q.id] === option && <div className="w-1.5 h-1.5 rounded-full bg-eng-600" />}
                                    </div>
                                    {option}
                                 </button>
                              ))}
                           </div>
                        </div>
                      ))}
                      
                      <div className="pt-2 flex justify-end">
                         <button 
                           onClick={handleSubmitSelections}
                           disabled={!isFormComplete || isProcessing}
                           className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
                         >
                            <span>Confirmar Selección</span>
                            <Send className="w-3 h-3" />
                         </button>
                      </div>
                   </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isProcessing && (
           <div className="flex justify-start">
            <div className="flex gap-3 max-w-[80%]">
              <div className="w-8 h-8 rounded-full bg-eng-600 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 text-sm rounded-tl-none">
                 Procesando respuesta...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Manual (Fallback) */}
      {!showOptionsForm && !isReadyToGenerate && (
        <div className="p-4 bg-slate-800 border-t border-slate-700 absolute bottom-0 w-full z-20">
          <form onSubmit={handleSubmitText} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe detalles adicionales..."
              className="w-full bg-slate-900 border border-slate-600 rounded-xl py-3 pl-4 pr-12 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-eng-500 focus:border-transparent font-sans"
              autoFocus
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isProcessing}
              className="absolute right-2 top-2 p-1.5 bg-eng-600 hover:bg-eng-500 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ClarificationChat;