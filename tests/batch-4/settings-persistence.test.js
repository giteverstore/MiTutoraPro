import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/settings/settingsDefaults';
import {
  SettingsService,
  SETTINGS_PERSISTENCE_STATUS,
} from '../../src/settings/SettingsService';

const clone = (value) => JSON.parse(JSON.stringify(value));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function createDataService(stored = clone(DEFAULT_SETTINGS)) {
  let value = stored;
  return {
    loadSettings: vi.fn(async () => clone(value)),
    saveSettings: vi.fn(async (_uid, next) => {
      value = clone(next);
      return clone(next);
    }),
    read: () => clone(value),
  };
}

describe('SettingsService persistence feedback', () => {
  it('reports saving and saved for a successful write', async () => {
    const dataService = createDataService();
    const service = new SettingsService({ dataService });
    await service.setUser('learner');
    const pending = service.setSetting('editor.fontSize', 18);
    expect(service.getPersistenceSnapshot().status).toBe(SETTINGS_PERSISTENCE_STATUS.SAVING);
    await pending;
    expect(service.getPersistenceSnapshot().status).toBe(SETTINGS_PERSISTENCE_STATUS.SAVED);
    expect(dataService.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed save and succeeds when retried', async () => {
    const dataService = createDataService();
    dataService.saveSettings
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }))
      .mockImplementationOnce(async (_uid, next) => next);
    const service = new SettingsService({ dataService });
    await service.setUser('learner');
    await expect(service.setSetting('editor.wordWrap', false)).rejects.toThrow('offline');
    expect(service.getPersistenceSnapshot().status).toBe(SETTINGS_PERSISTENCE_STATUS.ERROR);
    await service.retry();
    expect(service.getPersistenceSnapshot().status).toBe(SETTINGS_PERSISTENCE_STATUS.SAVED);
  });

  it('serializes rapid changes and persists only the newest pending snapshot', async () => {
    const firstWrite = deferred();
    const dataService = createDataService();
    dataService.saveSettings
      .mockImplementationOnce(() => firstWrite.promise)
      .mockImplementation(async (_uid, next) => next);
    const service = new SettingsService({ dataService });
    await service.setUser('learner');
    const first = service.setSetting('editor.fontSize', 16);
    service.setSetting('editor.fontSize', 18);
    service.setSetting('editor.fontSize', 20);
    expect(dataService.saveSettings).toHaveBeenCalledTimes(1);
    firstWrite.resolve();
    await first;
    expect(dataService.saveSettings).toHaveBeenCalledTimes(2);
    expect(dataService.saveSettings.mock.calls[1][1].editor.fontSize).toBe(20);
    expect(service.getPersistenceSnapshot().persistedRevision).toBe(3);
  });

  it('reloads the last successfully saved settings', async () => {
    const dataService = createDataService();
    const first = new SettingsService({ dataService });
    await first.setUser('learner');
    await first.setSetting('appearance.theme', 'dark');
    const reloaded = new SettingsService({ dataService });
    await reloaded.setUser('learner');
    expect(reloaded.getSetting('appearance.theme')).toBe('dark');
  });
});
