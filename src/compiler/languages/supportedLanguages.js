import { javaLanguage } from './java.js';
import { pythonLanguage } from './python.js';

export const supportedCompilerLanguages = Object.freeze([
  pythonLanguage,
  javaLanguage,
]);

export function getSupportedCompilerLanguage(languageId) {
  const normalizedId = String(languageId ?? '').trim().toLowerCase();
  return supportedCompilerLanguages.find(({ id }) => id === normalizedId) ?? null;
}

export function resolveCompilerLanguageOptions(compilerDefinitions, languages = supportedCompilerLanguages) {
  const definitions = new Map(
    compilerDefinitions.map((definition) => [definition.language.toLowerCase(), definition]),
  );

  return languages.map((language) => ({
    ...language,
    available: definitions.has(language.id),
    definition: definitions.get(language.id) ?? null,
  }));
}
