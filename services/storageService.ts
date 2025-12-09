import { ProjectResponse } from "../types";

const STORAGE_KEY = 'ingenio_projects';

export const saveProject = (project: ProjectResponse): ProjectResponse => {
  const projects = loadProjects();
  
  const now = new Date().toISOString();
  const projectToSave = {
    ...project,
    lastModified: now,
    id: project.id || crypto.randomUUID()
  };

  const index = projects.findIndex(p => p.id === projectToSave.id);
  
  if (index >= 0) {
    // Update existing
    projects[index] = projectToSave;
  } else {
    // Create new
    projects.push(projectToSave);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error("Storage full or error saving", e);
    throw new Error("No se pudo guardar el proyecto. El almacenamiento local puede estar lleno.");
  }

  return projectToSave;
};

export const loadProjects = (): ProjectResponse[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Error loading projects", e);
    return [];
  }
};

export const deleteProject = (id: string): void => {
  const projects = loadProjects();
  const filtered = projects.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

export const getProjectById = (id: string): ProjectResponse | undefined => {
  const projects = loadProjects();
  return projects.find(p => p.id === id);
};