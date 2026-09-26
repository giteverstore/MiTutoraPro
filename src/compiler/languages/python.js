import { PythonRuntime } from '../runtimes/python/PythonRuntime.js';

export const pythonLanguage = Object.freeze({
  id: 'python',
  label: 'Python',
  category: 'general',
  categoryOrder: 1,
  selectorOrder: 1,
  monacoLanguage: 'python',
  defaultFileName: 'main.py',
  executionMode: 'terminal',
  createRuntime: () => new PythonRuntime(),
});
