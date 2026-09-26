import { JavaRuntime } from '../runtimes/java/JavaRuntime.js';

export const javaLanguage = Object.freeze({
  id: 'java',
  label: 'Java',
  category: 'general',
  categoryOrder: 2,
  selectorOrder: 2,
  monacoLanguage: 'java',
  defaultFileName: 'Main.java',
  executionMode: 'terminal',
  createRuntime: () => new JavaRuntime(),
});
