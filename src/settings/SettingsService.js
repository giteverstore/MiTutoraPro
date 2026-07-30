import { DEFAULT_SETTINGS } from './settingsDefaults';

const STORAGE_KEY = 'mi-tutora:settings:v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeSettings(defaults, stored) {
  return Object.fromEntries(
    Object.entries(defaults).map(([section, values]) => [
      section,
      { ...values, ...(stored?.[section] ?? {}) },
    ]),
  );
}

export class SettingsService {
  constructor({ storage = window.localStorage } = {}) {
    this.storage = storage;
    this.listeners = new Set();
    this.settings = this.load();
  }

  load() {
    try {
      return mergeSettings(DEFAULT_SETTINGS, JSON.parse(this.storage.getItem(STORAGE_KEY)));
    } catch {
      return clone(DEFAULT_SETTINGS);
    }
  }

  getSnapshot = () => this.settings;

  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSetting(path, fallback) {
    const value = path.split('.').reduce((current, key) => current?.[key], this.settings);
    return value ?? fallback;
  }

  setSetting(path, value) {
    const [section, key] = path.split('.');
    if (!section || !key || !(section in DEFAULT_SETTINGS)) {
      throw new Error(`Unknown setting path "${path}".`);
    }
    this.settings = {
      ...this.settings,
      [section]: { ...this.settings[section], [key]: value },
    };
    this.persist();
    return value;
  }

  resetSettings() {
    this.settings = clone(DEFAULT_SETTINGS);
    this.persist();
    return this.settings;
  }

  exportSettings() {
    return JSON.stringify({
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: this.settings,
    }, null, 2);
  }

  persist() {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    this.listeners.forEach((listener) => listener());
  }
}

export const settingsService = new SettingsService();
