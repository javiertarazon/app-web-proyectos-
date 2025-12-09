import { AppSettings, CountryCode, FileAttachment } from "../types";

const SETTINGS_KEY = 'ingenio_settings';

const DEFAULT_SETTINGS: AppSettings = {
  country: 'VE',
  customStandards: [],
  activeDisciplines: ['CIVIL', 'ELECTRICA']
};

export const loadSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  } catch (e) {
    console.error("Failed to load settings", e);
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings (likely quota exceeded)", e);
    // If quota exceeded, try to save without the custom files if they are huge
    if (settings.customStandards.length > 0) {
      alert("Alerta: El almacenamiento local está lleno. No se guardarán los archivos adjuntos en la configuración permanente, pero se mantendrá la selección de país.");
      const fallbackSettings = { ...settings, customStandards: [] };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(fallbackSettings));
    }
  }
};

export const addCustomStandard = (file: FileAttachment): AppSettings => {
  const current = loadSettings();
  const updated = {
    ...current,
    customStandards: [...current.customStandards, file]
  };
  saveSettings(updated);
  return updated;
};

export const removeCustomStandard = (index: number): AppSettings => {
  const current = loadSettings();
  const updated = {
    ...current,
    customStandards: current.customStandards.filter((_, i) => i !== index)
  };
  saveSettings(updated);
  return updated;
};
