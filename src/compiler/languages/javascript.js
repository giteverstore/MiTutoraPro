import { JavaScriptRuntime } from '../runtimes/javascript/JavaScriptRuntime.js';

export const javascriptLanguage = Object.freeze({
  id: 'javascript',
  label: 'JavaScript',
  category: 'web',
  categoryOrder: 2,
  selectorOrder: 3,
  aliases: ['js'],
  monacoLanguage: 'javascript',
  defaultFileName: 'main.js',
  executionMode: 'terminal',
  defaultSource: 'console.log("Hello, World!");',
  createRuntime: () => new JavaScriptRuntime(),
});
