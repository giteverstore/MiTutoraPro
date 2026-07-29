import { PythonRuntime } from '../runtimes/python/PythonRuntime.js';

export const pythonLanguage = Object.freeze({
  id: 'python',
  defaultFileName: 'main.py',
  createRuntime: () => new PythonRuntime(),
});
