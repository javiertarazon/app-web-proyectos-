import React, { useState, useRef } from 'react';
import { Send, Cpu, Paperclip, X, FileText } from 'lucide-react';
import { FileAttachment } from '../types';

interface InputSectionProps {
  onAnalyze: (description: string, files: FileAttachment[]) => void;
  isAnalyzing: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ onAnalyze, isAnalyzing }) => {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles: FileAttachment[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        // Support text, pdf, images
        if (file.type === "application/pdf" || file.type.startsWith("image/") || file.type === "text/plain" || file.name.endsWith(".csv")) {
          const reader = new FileReader();
          await new Promise<void>((resolve) => {
            reader.onload = (event) => {
              const base64String = (event.target?.result as string).split(',')[1];
              newFiles.push({
                name: file.name,
                mimeType: file.type,
                data: base64String
              });
              resolve();
            };
            reader.readAsDataURL(file);
          });
        } else {
          alert(`El archivo ${file.name} no es compatible. Use PDF, Imágenes o TXT/CSV.`);
        }
      }
      setFiles(prev => [...prev, ...newFiles]);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isAnalyzing) {
      onAnalyze(input, files);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-12 animate-fade-in-up">
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-eng-500">
            <Cpu className="w-5 h-5" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Definición del Proyecto</h2>
          </div>
          <span className="text-xs text-slate-500">Sube planos, normas o <strong>cálculos previos para verificar</strong></span>
        </div>
        
        <form onSubmit={handleSubmit} className="relative space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe tu proyecto o indica qué archivos estás subiendo para revisión.
Ej: 'Revisa la memoria descriptiva adjunta y completa los cálculos eléctricos faltantes...'
Ej: 'Verifica los cómputos métricos del PDF adjunto y genera el presupuesto actualizado...'"
            className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-eng-500 focus:border-transparent outline-none resize-none font-mono text-sm leading-relaxed transition-all"
            disabled={isAnalyzing}
          />

          {/* File List */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-700/50 px-3 py-1.5 rounded-lg border border-slate-600">
                  <FileText className="w-3 h-3 text-eng-400" />
                  <span className="text-xs text-slate-300 max-w-[150px] truncate">{file.name}</span>
                  <button type="button" onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                multiple 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="application/pdf,image/*,text/plain,.csv"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 transition-colors text-sm"
              >
                <Paperclip className="w-4 h-4" />
                <span>Adjuntar Archivos</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={!input.trim() || isAnalyzing}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
                !input.trim() || isAnalyzing
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-eng-600 hover:bg-eng-500 text-white shadow-lg shadow-eng-900/50 hover:shadow-eng-500/20'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span>Analizar y Generar</span>
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputSection;