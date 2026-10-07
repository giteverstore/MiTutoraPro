import { getSupportedCompilerLanguage } from '../../compiler/languages/supportedLanguages.js';
import { PROJECT_RUNTIME_DEFAULTS } from './projectRuntimeDefaults.js';

const extensionFor = (fileName) => String(fileName ?? '').match(/(\.[^.]+)$/)?.[1] ?? '';

export function getProjectRuntime(languageId, override = {}) {
  const language = getSupportedCompilerLanguage(languageId);
  if (!language) throw new TypeError(`Unknown project language: ${languageId}`);
  const defaults = PROJECT_RUNTIME_DEFAULTS[language.id] ?? {};
  const entrypoint = override.entrypoint ?? defaults.defaultFiles?.[0]?.path ?? language.defaultFileName;
  return Object.freeze({
    id: language.id, displayName: language.label, editorLanguage: language.monacoLanguage,
    fileExtension: defaults.fileExtension ?? extensionFor(entrypoint), runtime: defaults.runtime ?? language.label,
    buildCommand: null, runCommand: null, packageManager: null, entrypoint,
    icon: language.icon ?? null, executionMode: language.executionMode,
    ...defaults, ...override,
    defaultFiles: Object.freeze([...(override.defaultFiles ?? defaults.defaultFiles ?? [{ path: entrypoint, content: language.defaultSource ?? '' }])]),
  });
}

export function resolveProjectRuntime(project, languageId) {
  if (!project.supportedLanguages.includes(languageId)) throw new TypeError(`${languageId} is not supported by ${project.id}.`);
  return getProjectRuntime(languageId, project.languageOverrides?.[languageId]);
}

export const listProjectRuntimes = (project) => project.supportedLanguages.map((languageId) => resolveProjectRuntime(project, languageId));
