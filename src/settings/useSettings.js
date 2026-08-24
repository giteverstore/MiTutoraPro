import { useSyncExternalStore } from 'react';
import { settingsService } from './SettingsService';

export function useSettings() {
  return useSyncExternalStore(
    settingsService.subscribe,
    settingsService.getSnapshot,
    settingsService.getSnapshot,
  );
}

export function useSettingsPersistence() {
  return useSyncExternalStore(
    settingsService.subscribe,
    settingsService.getPersistenceSnapshot,
    settingsService.getPersistenceSnapshot,
  );
}
