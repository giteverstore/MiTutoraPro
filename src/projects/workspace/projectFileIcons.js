const LANGUAGE_ASSET = Object.freeze({
  python: '/assets/languages/python.svg',
  java: '/assets/languages/java.svg',
  javascript: '/assets/languages/javascript.svg',
  typescript: '/assets/languages/typescript.svg',
  cpp: '/assets/languages/cplusplus.svg',
  go: '/assets/languages/go.svg',
  rust: '/assets/languages/rust.svg',
  html: '/assets/languages/html5.svg',
});

const EXTENSION_ICONS = Object.freeze({
  py: { id: 'python', asset: LANGUAGE_ASSET.python },
  java: { id: 'java', asset: LANGUAGE_ASSET.java },
  js: { id: 'javascript', asset: LANGUAGE_ASSET.javascript },
  jsx: { id: 'javascript', asset: LANGUAGE_ASSET.javascript },
  ts: { id: 'typescript', asset: LANGUAGE_ASSET.typescript },
  tsx: { id: 'typescript', asset: LANGUAGE_ASSET.typescript },
  c: { id: 'c', monogram: 'C' },
  cpp: { id: 'cpp', asset: LANGUAGE_ASSET.cpp },
  cc: { id: 'cpp', asset: LANGUAGE_ASSET.cpp },
  cxx: { id: 'cpp', asset: LANGUAGE_ASSET.cpp },
  go: { id: 'go', asset: LANGUAGE_ASSET.go },
  rs: { id: 'rust', asset: LANGUAGE_ASSET.rust },
  html: { id: 'html', asset: LANGUAGE_ASSET.html },
  htm: { id: 'html', asset: LANGUAGE_ASSET.html },
  css: { id: 'css', monogram: 'CSS' },
  json: { id: 'json', lucide: 'json' },
  md: { id: 'markdown', lucide: 'text' },
  markdown: { id: 'markdown', lucide: 'text' },
  yml: { id: 'yaml', lucide: 'braces' },
  yaml: { id: 'yaml', lucide: 'braces' },
  sh: { id: 'shell', lucide: 'terminal' },
  bash: { id: 'shell', lucide: 'terminal' },
  zsh: { id: 'shell', lucide: 'terminal' },
});

export function projectFileIcon(path) {
  const name = String(path ?? '').split('/').at(-1).toLowerCase();
  if (name === 'dockerfile') return { id: 'dockerfile', lucide: 'container' };
  if (name === '.gitignore') return { id: 'gitignore', lucide: 'git' };
  if (name === 'cargo.toml') return { id: 'rust', asset: LANGUAGE_ASSET.rust };
  if (name === 'readme' || name.startsWith('readme.')) return { id: 'readme', lucide: 'text' };
  const extension = name.includes('.') ? name.split('.').at(-1) : '';
  return EXTENSION_ICONS[extension] ?? { id: 'file', lucide: 'file' };
}
