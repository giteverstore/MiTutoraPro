import { useEffect, useMemo, useState } from 'react';
import { useApplicationTheme } from '../../theme/useApplicationTheme';

export const PROJECT_WORKSPACE_PREFERENCES_KEY = 'ycoders.projectWorkspace.editorPreferences';
export const DEFAULT_PROJECT_WORKSPACE_PREFERENCES = Object.freeze({ appearance: 'follow-app', fontSize: 14, tabSize: 4, wordWrap: true });

function readPreferences() {
  try {
    return { ...DEFAULT_PROJECT_WORKSPACE_PREFERENCES, ...JSON.parse(localStorage.getItem(PROJECT_WORKSPACE_PREFERENCES_KEY) || '{}') };
  } catch { return { ...DEFAULT_PROJECT_WORKSPACE_PREFERENCES }; }
}

export function useProjectWorkspacePreferences() {
  const applicationTheme = useApplicationTheme();
  const [preferences, setPreferences] = useState(readPreferences);
  useEffect(() => { localStorage.setItem(PROJECT_WORKSPACE_PREFERENCES_KEY, JSON.stringify(preferences)); }, [preferences]);
  const resolvedTheme = preferences.appearance === 'follow-app' ? applicationTheme.theme : preferences.appearance;
  return useMemo(() => ({
    preferences,
    resolvedTheme,
    editorPreferences: { ...preferences, monacoTheme: resolvedTheme === 'dark' ? 'ycoders-dark' : 'ycoders-light' },
    update: (key, value) => setPreferences((current) => ({ ...current, [key]: value })),
    reset: () => setPreferences({ ...DEFAULT_PROJECT_WORKSPACE_PREFERENCES }),
  }), [applicationTheme.theme, preferences, resolvedTheme]);
}
