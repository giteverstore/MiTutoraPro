export const STANDALONE_LANGUAGE_ICONS = Object.freeze({
  python: '/assets/languages/python.svg', java: '/assets/languages/java.svg', javascript: '/assets/languages/javascript.svg',
  typescript: '/assets/languages/typescript.svg', go: '/assets/languages/go.svg', cpp: '/assets/languages/cplusplus.svg',
  rust: '/assets/languages/rust.svg', 'html-css': '/assets/languages/html5.svg', sql: '/assets/languages/sql.svg', csharp: '/assets/languages/csharp.svg',
});

export function standaloneLanguageMonogram(language) {
  if (language.id === 'visualbasic') return 'VB';
  if (language.id === 'assembly') return 'ASM';
  return language.label.replace(/[^A-Za-z+#]/g, '').slice(0, 3);
}
