import React, { useState, useEffect } from 'react';
import { ProjectResponse } from '../types';
import { loadProjects, deleteProject } from '../services/storageService';
import { 
  FolderOpen, 
  Trash2, 
  Search, 
  Plus, 
  Clock, 
  FileText, 
  Download,
  MoreVertical
} from 'lucide-react';

interface ProjectListProps {
  onOpenProject: (project: ProjectResponse) => void;
  onNewProject: () => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ onOpenProject, onNewProject }) => {
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de eliminar este proyecto permanentemente?')) {
      deleteProject(id);
      setProjects(loadProjects());
    }
  };

  const handleDownload = (project: ProjectResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    const jsonString = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Proyecto_${project.projectTitle.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredProjects = projects.filter(p => 
    p.projectTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.discipline.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.lastModified || 0).getTime() - new Date(a.lastModified || 0).getTime());

  return (
    <div className="w-full max-w-6xl mx-auto p-4 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-1">Mis Proyectos</h2>
          <p className="text-slate-400 text-sm">Gestiona y edita tus expedientes de ingeniería</p>
        </div>
        <button 
          onClick={onNewProject}
          className="bg-eng-600 hover:bg-eng-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-eng-900/20 transition-transform hover:scale-105"
        >
          <Plus className="w-5 h-5" />
          Nuevo Proyecto
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm min-h-[60vh]">
        
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-3.5 text-slate-500 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Buscar por nombre de proyecto o disciplina..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-eng-500 transition-all"
          />
        </div>

        {/* Grid */}
        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <div 
                key={project.id}
                onClick={() => onOpenProject(project)}
                className="group bg-slate-800 border border-slate-700 hover:border-eng-500/50 rounded-xl p-5 cursor-pointer transition-all hover:bg-slate-750 hover:shadow-xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                   <button 
                    onClick={(e) => handleDownload(project, e)}
                    className="p-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 hover:text-white"
                    title="Descargar JSON"
                   >
                     <Download className="w-4 h-4" />
                   </button>
                   <button 
                    onClick={(e) => handleDelete(project.id!, e)}
                    className="p-1.5 bg-red-900/50 text-red-300 rounded hover:bg-red-600 hover:text-white"
                    title="Eliminar"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                </div>

                <div className="flex items-start justify-between mb-3">
                  <div className="bg-slate-900 p-2.5 rounded-lg">
                    <FileText className="w-6 h-6 text-eng-500" />
                  </div>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 border border-slate-700 px-2 py-0.5 rounded-full">
                    {project.discipline}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 line-clamp-1 group-hover:text-eng-400 transition-colors">
                  {project.projectTitle}
                </h3>

                <div className="text-xs text-slate-400 space-y-1 mb-4">
                  <p className="line-clamp-2 h-8">{project.memoriaDescriptiva.descripcionProyecto.substring(0, 80)}...</p>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-slate-500 border-t border-slate-700/50 pt-3">
                   <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(project.lastModified || '').toLocaleDateString()}
                   </span>
                   <span>
                      ${project.presupuesto.reduce((acc, p) => acc + p.precioTotal, 0).toLocaleString()}
                   </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
             <FolderOpen className="w-12 h-12 mb-4 opacity-50" />
             <p className="text-lg">No se encontraron proyectos</p>
             {searchTerm ? (
               <p className="text-sm">Intenta con otra búsqueda</p>
             ) : (
               <p className="text-sm">Crea tu primer proyecto para empezar</p>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectList;