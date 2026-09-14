import { PythonRuntime } from '../runtimes/python/PythonRuntime.js';

export const pythonLanguage = Object.freeze({
  id: 'python',
  label: 'Python',
  monacoLanguage: 'python',
  defaultFileName: 'main.py',
  createRuntime: () => new PythonRuntime(),
});
