import { useEffect, useMemo, useState } from 'react';
import { useApplicationTheme } from '../theme/useApplicationTheme.js';

export const STANDALONE_PREFERENCES_KEY = 'ycoders.standaloneCompiler.preferences';
export const DEFAULT_STANDALONE_PREFERENCES = Object.freeze({ appearance: 'follow-app', fontSize: 13, tabSize: 4, wordWrap: true });

function readPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem(STANDALONE_PREFERENCES_KEY) || '{}');
    return { ...DEFAULT_STANDALONE_PREFERENCES, ...stored };
  } catch { return { ...DEFAULT_STANDALONE_PREFERENCES }; }
}

export function useStandaloneCompilerPreferences() {
  const applicationTheme = useApplicationTheme();
  const [preferences, setPreferences] = useState(readPreferences);
  useEffect(() => { localStorage.setItem(STANDALONE_PREFERENCES_KEY, JSON.stringify(preferences)); }, [preferences]);
  const resolvedTheme = preferences.appearance === 'follow-app'
    ? (applicationTheme.theme === 'dark' ? 'dark' : 'light')
    : preferences.appearance;
  return useMemo(() => ({
    preferences,
    resolvedTheme,
    update: (key, value) => setPreferences((current) => ({ ...current, [key]: value })),
    reset: () => setPreferences({ ...DEFAULT_STANDALONE_PREFERENCES }),
  }), [preferences, resolvedTheme]);
}
