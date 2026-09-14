import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveCompilerLanguageOptions } from './languages/supportedLanguages.js';

const PREFERENCE_KEY = 'ycoders.compiler.preferredLanguage';

function readPreference() {
  try { return window.localStorage.getItem(PREFERENCE_KEY); } catch { return null; }
}

function writePreference(languageId) {
  try { window.localStorage.setItem(PREFERENCE_KEY, languageId); } catch { /* preference is optional */ }
}

export function useSelectableCompilerLanguage(definitions, preferredLanguage = 'python') {
  const panelRef = useRef(null);
  const options = useMemo(() => resolveCompilerLanguageOptions(definitions), [definitions]);
  const [language, setLanguage] = useState(() => {
    const available = new Set(options.filter((option) => option.available).map((option) => option.id));
    const persisted = readPreference();
    if (persisted && available.has(persisted)) return persisted;
    const preferred = String(preferredLanguage ?? '').toLowerCase();
    if (available.has(preferred)) return preferred;
    if (available.has('python')) return 'python';
    return options.find((option) => option.available)?.id ?? '';
  });
  const [switching, setSwitching] = useState(false);
  const activeDefinition = options.find((option) => option.id === language)?.definition
    ?? options.find((option) => option.available)?.definition
    ?? null;

  useEffect(() => {
    if (options.some((option) => option.id === language && option.available)) return;
    const available = new Set(options.filter((option) => option.available).map((option) => option.id));
    const persisted = readPreference();
    const preferred = String(preferredLanguage ?? '').toLowerCase();
    setLanguage(
      (persisted && available.has(persisted) && persisted)
      || (available.has(preferred) && preferred)
      || (available.has('python') && 'python')
      || options.find((option) => option.available)?.id
      || '',
    );
  }, [language, options, preferredLanguage]);

  const selectLanguage = useCallback(async (nextLanguage) => {
    if (nextLanguage === language) return;
    const option = options.find(({ id }) => id === nextLanguage);
    if (!option?.available || !option.definition || !panelRef.current) return;
    setSwitching(true);
    try {
      const changed = await panelRef.current.loadDefinition(option.definition, {
        replacementDescription: `Switching language will replace your current code with the starter code for ${option.label}.`,
        replacementConfirmLabel: 'Switch Language',
      });
      if (changed) {
        setLanguage(nextLanguage);
        writePreference(nextLanguage);
      }
    } finally {
      setSwitching(false);
    }
  }, [language, options]);

  const languageLabel = options.find((option) => option.id === language)?.label ?? language;
  return { activeDefinition, language, languageLabel, options, panelRef, selectLanguage, switching };
}
