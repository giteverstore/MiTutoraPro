import { TypeScriptRuntime } from '../runtimes/typescript/TypeScriptRuntime.js';

export const typescriptLanguage = Object.freeze({
  id: 'typescript',
  label: 'TypeScript',
  category: 'web',
  categoryOrder: 3,
  selectorOrder: 4,
  aliases: ['ts'],
  monacoLanguage: 'typescript',
  defaultFileName: 'main.ts',
  executionMode: 'terminal',
  defaultSource: 'const message: string = "Hello, World!";\nconsole.log(message);',
  createRuntime: () => new TypeScriptRuntime(),
});
