import { DEFAULT_SETTINGS } from './settingsDefaults';
import { userDataService } from '../user-data/UserDataService';

function clone(value) {
  return parseJson(JSON.stringify(value), import.meta.url);
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
  constructor({ dataService = userDataService } = {}) {
    this.dataService = dataService;
    this.listeners = new Set();
    this.settings = clone(DEFAULT_SETTINGS);
    this.userId = null;
    this.error = null;
  }

  async setUser(userId) {
    this.userId = userId ?? null;
    const requestedUserId = this.userId;
    this.error = null;
    if (!this.userId) {
      this.settings = clone(DEFAULT_SETTINGS);
      this.notify();
      return this.settings;
    }
    try {
      const stored = await this.dataService.loadSettings(this.userId);
      if (this.userId !== requestedUserId) return this.settings;
      this.settings = mergeSettings(DEFAULT_SETTINGS, stored);
      if (!stored) await this.dataService.saveSettings(this.userId, this.settings);
      if (this.userId !== requestedUserId) return this.settings;
      this.notify();
      return this.settings;
    } catch (error) {
      if (this.userId !== requestedUserId) return this.settings;
      this.error = error;
      this.notify();
      throw error;
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
    this.notify();
    if (!this.userId) return Promise.resolve(this.settings);
    return this.dataService.saveSettings(this.userId, this.settings).catch((error) => {
      this.error = error;
      console.error('[Settings] Unable to persist preferences.', error);
      this.notify();
      return this.settings;
    });
  }

  notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const settingsService = new SettingsService();
import { parseJson } from '../utils/parseJson';
