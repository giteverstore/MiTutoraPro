const DEFAULT_FILE_NAMES = Object.freeze({
  python: 'main.py',
  javascript: 'main.js',
  java: 'Main.java',
  cpp: 'main.cpp',
  sql: 'query.sql',
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
    stdin: definition.stdin ?? definition.inputs ?? '',
    expectedOutput: definition.expectedOutput,
    validatorType: resolveValidatorType(definition.validator, definition.validation),
    validatorOptions: resolveValidatorOptions(definition.validator, definition.validation),
    execution: definition.execution,
    timeoutMs: definition.timeoutMs,
    testCases: definition.testCases ?? [],
  };
}
