import { ReactPreviewRuntime } from '../runtimes/preview/ReactPreviewRuntime.js';

export const reactLanguage = Object.freeze({
  id: 'react', label: 'React', category: 'web', categoryOrder: 4, selectorOrder: 11, monacoLanguage: 'javascript', defaultFileName: 'App.jsx', executionMode: 'preview',
  defaultSource: 'function App() {\n  return <h1>Hello React!</h1>;\n}',
  createRuntime: () => new ReactPreviewRuntime(),
});
