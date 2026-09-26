import { supportedCompilerLanguages } from './languages/supportedLanguages.js';

export function getDevelopmentCompilerOptions() {
  return supportedCompilerLanguages.map(({ createRuntime: _createRuntime, ...language }) => ({
    ...language,
    available: true,
  }));
}

export function createDevelopmentCompilerDefinition(baseDefinition, language, source) {
  if (!import.meta.env.DEV) return null;
  const registeredLanguage = supportedCompilerLanguages.find(({ id }) => id === language);
  if (!registeredLanguage) return null;

  const executionMode = registeredLanguage.executionMode ?? 'terminal';
  const preserveSource = !registeredLanguage.resetSourceOnSelect
    && executionMode === 'terminal'
    && (baseDefinition.executionMode ?? 'terminal') === 'terminal';
  const overrideSource = preserveSource ? source : registeredLanguage.defaultSource ?? source;
  return {
    ...baseDefinition,
    id: `${baseDefinition.id}:development:${registeredLanguage.id}`,
    language: registeredLanguage.id,
    executionMode,
    exerciseId: null,
    expectedOutput: undefined,
    validatorType: undefined,
    validatorOptions: undefined,
    execution: undefined,
    setupSql: undefined,
    testCases: [],
    editor: {
      ...baseDefinition.editor,
      fileName: registeredLanguage.defaultFileName,
      language: registeredLanguage.monacoLanguage,
      ariaLabel: `${registeredLanguage.defaultFileName} code editor`,
      lines: String(overrideSource ?? '').split('\n').map((text, index) => ({ number: index + 1, text, tone: 'source' })),
    },
    footerItems: [
      `File: ${registeredLanguage.defaultFileName}`,
      `Language: ${registeredLanguage.label}`,
      'Development runtime override',
    ],
    isDevelopmentOverride: true,
  };
}
