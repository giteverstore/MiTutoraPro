import { javaLanguage } from './java.js';
import { pythonLanguage } from './python.js';
import { javascriptLanguage } from './javascript.js';
import { typescriptLanguage } from './typescript.js';
import { htmlCssLanguage } from './htmlCss.js';
import { reactLanguage } from './react.js';
import { sqlLanguage } from './sql.js';
import { cLanguage } from './c.js';
import { cppLanguage } from './cpp.js';
import { mysqlLanguage } from './mysql.js';
import { phpLanguage } from './php.js';
import { rLanguage } from './r.js';
import { csharpLanguage } from './csharp.js';
import { visualBasicLanguage } from './visualbasic.js';
import { assemblyLanguage } from './assembly.js';
import { goLanguage } from './go.js';
import { rustLanguage } from './rust.js';

export const COMPILER_LANGUAGE_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'web', label: 'Web Technologies', order: 1, column: 1 }),
  Object.freeze({ id: 'general', label: 'General Programming', order: 2, column: 2 }),
  Object.freeze({ id: 'systems', label: 'Systems Programming', order: 3, column: 3 }),
  Object.freeze({ id: 'dotnet', label: '.NET', order: 4, column: 1 }),
  Object.freeze({ id: 'data', label: 'Data & Databases', order: 5, column: 2 }),
]);

export const supportedCompilerLanguages = Object.freeze([
  pythonLanguage,
  javaLanguage,
  javascriptLanguage,
  typescriptLanguage,
  htmlCssLanguage,
  reactLanguage,
  sqlLanguage,
  cLanguage,
  cppLanguage,
  mysqlLanguage,
  phpLanguage,
  rLanguage,
  csharpLanguage,
  visualBasicLanguage,
  assemblyLanguage,
  goLanguage,
  rustLanguage,
]);

const PUBLIC_LANGUAGE_METADATA = Object.freeze({
  python: { publicSlug: 'python', aliases: ['py'], defaultSource: 'print("Hello, World!")' },
  java: { publicSlug: 'java', aliases: [], defaultSource: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}' },
  javascript: { publicSlug: 'javascript', aliases: ['js'] },
  typescript: { publicSlug: 'typescript', aliases: ['ts'] },
  'html-css': { publicSlug: 'html-css', aliases: ['html', 'css'] },
  react: { publicSlug: 'react', aliases: [] },
  sql: { publicSlug: 'sql', aliases: ['sqlite'] },
  mysql: { publicSlug: 'mysql', aliases: [] },
  c: { publicSlug: 'c', aliases: [] },
  cpp: { publicSlug: 'cpp', aliases: ['c++'] },
  php: { publicSlug: 'php', aliases: [] },
  r: { publicSlug: 'r', aliases: [] },
  csharp: { publicSlug: 'csharp', aliases: ['cs', 'c#'] },
  visualbasic: { publicSlug: 'visual-basic', aliases: ['vb', 'vb.net'] },
  assembly: { publicSlug: 'assembly', aliases: ['asm'] },
  go: { publicSlug: 'go', aliases: ['golang'] },
  rust: { publicSlug: 'rust', aliases: ['rs'] },
});

export const publicCompilerLanguages = Object.freeze(supportedCompilerLanguages.map((language) => Object.freeze({
  ...language,
  ...PUBLIC_LANGUAGE_METADATA[language.id],
  aliases: Object.freeze([...(language.aliases ?? []), ...(PUBLIC_LANGUAGE_METADATA[language.id]?.aliases ?? [])]),
})));

export function getPublicCompilerLanguage(slugOrAlias) {
  const value = decodeURIComponent(String(slugOrAlias ?? '')).trim().toLowerCase();
  return publicCompilerLanguages.find((language) => language.publicSlug === value || language.aliases.includes(value)) ?? null;
}

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

export function groupCompilerLanguageOptions(options) {
  const availableOptions = options.filter(({ available }) => available !== false);
  return COMPILER_LANGUAGE_CATEGORIES
    .map((category) => ({
      ...category,
      languages: availableOptions
        .filter((language) => language.category === category.id)
        .sort((left, right) => left.categoryOrder - right.categoryOrder),
    }))
    .filter(({ languages }) => languages.length > 0);
}

export function sortCompilerLanguageOptions(options) {
  return options
    .filter(({ available }) => available !== false)
    .sort((left, right) => left.selectorOrder - right.selectorOrder);
}
