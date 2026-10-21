import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupportedCompilerLanguage, resolveCompilerLanguageOptions } from './languages/supportedLanguages.js';

function createUnavailableActivityCompilerDefinition(option) {
  const language = getSupportedCompilerLanguage(option.id);
  if (!language) throw new Error(`Missing canonical compiler language: ${option.id}`);
  return {
    id: `unconfigured-${language.id}`,
    title: 'Compiler', status: 'Unavailable', language: language.id, languageLabel: 'Language',
    runtimeAvailable: false, runLabel: 'Run', resetLabel: 'Reset',
    editor: { fileName: language.defaultFileName, ariaLabel: `${language.label} code editor`, language: language.monacoLanguage, lines: [] },
    output: {
      outputTabLabel: 'Output', errorsTabLabel: 'Errors', errorCount: 0, prompt: '>_',
      emptyTitle: 'Compiler not available for this language yet',
      emptyDescription: 'You can use the editor, but this activity has no configured runtime for the selected language.',
      errorTitle: 'No errors', errorDescription: 'Compiler errors will appear here.',
    },
    starterCode: '', stdin: '', expectedOutput: undefined, testCases: [],
  };
}

const PREFERENCE_KEY = 'ycoders.compiler.preferredLanguage';

function readPreference() {
  try { return window.localStorage.getItem(PREFERENCE_KEY); } catch { return null; }
}

function writePreference(languageId) {
  try { window.localStorage.setItem(PREFERENCE_KEY, languageId); } catch { /* preference is optional */ }
}

export function useSelectableCompilerLanguage(definitions, preferredLanguage = 'python', { languages, includeUnavailable = false } = {}) {
  const panelRef = useRef(null);
  const options = useMemo(() => resolveCompilerLanguageOptions(definitions, languages)
    .map((option) => includeUnavailable && !option.definition
      ? { ...option, available: true, configured: false, definition: createUnavailableActivityCompilerDefinition(option) }
      : { ...option, configured: Boolean(option.definition) }), [definitions, includeUnavailable, languages]);
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
  const configured = options.find((option) => option.id === language)?.configured !== false;
  return { activeDefinition, configured, language, languageLabel, options, panelRef, selectLanguage, switching };
}
