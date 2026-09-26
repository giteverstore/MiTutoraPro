const DEFAULT_FILE_NAMES = Object.freeze({
  python: 'main.py',
  javascript: 'main.js',
  typescript: 'main.ts',
  'html-css': 'index.html',
  react: 'App.jsx',
  java: 'Main.java',
  c: 'main.c',
  cpp: 'main.cpp',
  sql: 'query.sql',
  mysql: 'query.sql',
  php: 'main.php',
  r: 'main.R',
  csharp: 'Program.cs',
  visualbasic: 'Program.vb',
  assembly: 'main.asm',
  go: 'main.go',
  rust: 'main.rs',
});

function resolveValidatorType(validator, validation) {
  if (typeof validator === 'string') return validator;
  return validator?.type ?? validation?.type ?? 'normalized';
}

function resolveValidatorOptions(validator, validation) {
  const definition = typeof validator === 'object' ? validator : validation;
  if (!definition) return undefined;
  const { type: _type, ...options } = definition;
  return options;
}

/**
 * Converts both the canonical compiler JSON shape and legacy course blocks
 * into the language-agnostic definition consumed by CompilerManager.
 */
export function normalizeCompilerDefinition(definition) {
  const language = String(definition.language ?? '').toLowerCase();
  const legacyFileName = definition.activeFile ?? definition.files?.[0]?.name;
  const fileName = legacyFileName ?? DEFAULT_FILE_NAMES[language] ?? 'main.txt';
  const legacyFile = definition.files?.find((file) => file.name === fileName);

  return {
    language,
    fileName,
    starterCode: definition.starterCode ?? legacyFile?.content ?? '',
    stdin: definition.stdin ?? definition.input ?? definition.inputs ?? '',
    expectedOutput: definition.expectedOutput,
    validatorType: resolveValidatorType(definition.validator, definition.validation),
    validatorOptions: resolveValidatorOptions(definition.validator, definition.validation),
    execution: definition.execution,
    setupSql: definition.setupSql ?? definition.execution?.setupSql ?? '',
    timeoutMs: definition.timeoutMs,
    testCases: definition.testCases ?? [],
  };
}
