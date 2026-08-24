import { DEFAULT_SETTINGS } from './settingsDefaults';
import { userDataService } from '../user-data/UserDataService';

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

export const SETTINGS_PERSISTENCE_STATUS = Object.freeze({
  IDLE: 'IDLE',
  SAVING: 'SAVING',
  SAVED: 'SAVED',
  ERROR: 'ERROR',
});

const serialize = (value) => JSON.stringify(value);

export class SettingsService {
  constructor({ dataService = userDataService } = {}) {
    this.dataService = dataService;
    this.listeners = new Set();
    this.settings = clone(DEFAULT_SETTINGS);
    this.userId = null;
    this.error = null;
    this.persistence = Object.freeze({
      status: SETTINGS_PERSISTENCE_STATUS.IDLE,
      error: null,
      revision: 0,
      persistedRevision: 0,
    });
    this.persistenceSnapshot = this.persistence;
    this.revision = 0;
    this.persistedRevision = 0;
    this.persistedSettings = serialize(this.settings);
    this.persistPromise = null;
    this.userGeneration = 0;
  }

  async setUser(userId) {
    this.userGeneration += 1;
    const generation = this.userGeneration;
    this.userId = userId ?? null;
    const requestedUserId = this.userId;
    this.error = null;
    this.persistPromise = null;
    this.revision = 0;
    this.persistedRevision = 0;
    this.updatePersistence(SETTINGS_PERSISTENCE_STATUS.IDLE);
    if (!this.userId) {
      this.settings = clone(DEFAULT_SETTINGS);
      this.persistedSettings = serialize(this.settings);
      this.updatePersistence(SETTINGS_PERSISTENCE_STATUS.IDLE);
      this.notify();
      return this.settings;
    }
    try {
      const stored = await this.dataService.loadSettings(this.userId);
      if (this.userId !== requestedUserId || generation !== this.userGeneration) return this.settings;
      this.settings = mergeSettings(DEFAULT_SETTINGS, stored);
      this.persistedSettings = stored ? serialize(this.settings) : '';
      this.notify();
      if (!stored) await this.persist();
      if (this.userId !== requestedUserId || generation !== this.userGeneration) return this.settings;
      return this.settings;
    } catch (error) {
      if (this.userId !== requestedUserId || generation !== this.userGeneration) return this.settings;
      this.error = error;
      this.updatePersistence(SETTINGS_PERSISTENCE_STATUS.ERROR, error);
      this.notify();
      throw error;
    }
  }

  getSnapshot = () => this.settings;
  getPersistenceSnapshot = () => this.persistenceSnapshot;

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
    this.revision += 1;
    this.notify();
    return this.persist();
  }

  resetSettings() {
    this.settings = clone(DEFAULT_SETTINGS);
    this.revision += 1;
    this.notify();
    return this.persist();
  }

  exportSettings() {
    return JSON.stringify({
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      settings: this.settings,
    }, null, 2);
  }

  persist() {
    if (!this.userId) {
      this.persistedSettings = serialize(this.settings);
      this.persistedRevision = this.revision;
      this.updatePersistence(SETTINGS_PERSISTENCE_STATUS.IDLE);
      this.notify();
      return Promise.resolve(this.settings);
    }
    if (serialize(this.settings) === this.persistedSettings) {
      this.persistedRevision = this.revision;
      this.updatePersistence(SETTINGS_PERSISTENCE_STATUS.SAVED);
      this.notify();
      return Promise.resolve(this.settings);
    }
    if (this.persistPromise) return this.persistPromise;

    const generation = this.userGeneration;
    const userId = this.userId;
    this.persistPromise = this.drainPersistence({ generation, userId })
      .finally(() => {
        this.persistPromise = null;
      });
    return this.persistPromise;
  }

  async drainPersistence({ generation, userId }) {
    while (generation === this.userGeneration && userId === this.userId) {
      const snapshot = clone(this.settings);
      const serialized = serialize(snapshot);
      const targetRevision = this.revision;
      if (serialized === this.persistedSettings) break;

      this.updatePersistence(SETTINGS_PERSISTENCE_STATUS.SAVING);
      this.notify();
      try {
        await this.dataService.saveSettings(userId, snapshot);
      } catch (error) {
        if (generation === this.userGeneration && userId === this.userId) {
          this.error = error;
          this.updatePersistence(SETTINGS_PERSISTENCE_STATUS.ERROR, error);
          this.notify();
        }
        throw error;
      }
      if (generation !== this.userGeneration || userId !== this.userId) return this.settings;
      this.persistedSettings = serialized;
      this.persistedRevision = targetRevision;
      this.error = null;
    }

    if (generation === this.userGeneration && userId === this.userId) {
      this.updatePersistence(SETTINGS_PERSISTENCE_STATUS.SAVED);
      this.notify();
    }
    return this.settings;
  }

  retry() {
    if (this.persistence.status !== SETTINGS_PERSISTENCE_STATUS.ERROR) {
      return Promise.resolve(this.settings);
    }
    return this.persist();
  }

  updatePersistence(status, error = null) {
    this.persistence = Object.freeze({
      status,
      error,
      revision: this.revision,
      persistedRevision: this.persistedRevision,
    });
    this.persistenceSnapshot = this.persistence;
  }

  notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const settingsService = new SettingsService();
