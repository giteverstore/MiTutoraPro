import { HtmlPreviewRuntime } from '../runtimes/preview/HtmlPreviewRuntime.js';

export const htmlCssLanguage = Object.freeze({
  id: 'html-css', label: 'HTML/CSS', category: 'web', categoryOrder: 1, selectorOrder: 10, monacoLanguage: 'html', defaultFileName: 'index.html', executionMode: 'preview',
  defaultSource: '<!doctype html>\n<html>\n<head>\n  <style>h1 { color: royalblue; }</style>\n</head>\n<body>\n  <h1>Hello YCoders</h1>\n</body>\n</html>',
  createRuntime: () => new HtmlPreviewRuntime(),
});
