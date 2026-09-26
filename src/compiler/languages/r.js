import { RRuntime } from '../runtimes/r/RRuntime.js';

export const rLanguage = Object.freeze({
  id: 'r',
  label: 'R',
  category: 'data',
  categoryOrder: 3,
  selectorOrder: 13,
  monacoLanguage: 'r',
  defaultFileName: 'main.R',
  executionMode: 'terminal',
  resetSourceOnSelect: true,
  defaultSource: 'print("Hello, World!")',
  createRuntime: () => new RRuntime(),
});
