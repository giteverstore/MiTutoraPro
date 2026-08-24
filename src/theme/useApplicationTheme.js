import { useSyncExternalStore } from 'react';
import { settingsService } from '../settings/SettingsService';
import { useSettings } from '../settings/useSettings';

let systemDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
const listeners = new Set();
if (typeof window !== 'undefined') {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', ({ matches }) => {
    systemDark = matches;
    listeners.forEach((listener) => listener());
  });
}
const subscribeSystemTheme = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
const getSystemTheme = () => systemDark ? 'dark' : 'light';

export function useApplicationTheme() {
  const settings = useSettings();
  const systemTheme = useSyncExternalStore(subscribeSystemTheme, getSystemTheme, () => 'light');
  const preference = settings.appearance.theme;
  const theme = resolveApplicationTheme(preference, systemTheme);
  const setTheme = (value) => settingsService.setSetting('appearance.theme', value);
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  return { theme, preference, reducedMotion: settings.appearance.reducedMotion, setTheme, toggleTheme };
}

export const resolveApplicationTheme = (preference, systemTheme) => preference === 'system' ? systemTheme : preference;
