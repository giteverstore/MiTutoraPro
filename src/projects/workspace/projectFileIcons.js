const EXTENSION_ICONS = Object.freeze({
  py: { id: 'python', lucide: 'code' },
  java: { id: 'java', lucide: 'code' },
  js: { id: 'javascript', lucide: 'code' },
  jsx: { id: 'javascript', lucide: 'code' },
  ts: { id: 'typescript', lucide: 'code' },
  tsx: { id: 'typescript', lucide: 'code' },
  c: { id: 'c', lucide: 'code' },
  cpp: { id: 'cpp', lucide: 'code' },
  cc: { id: 'cpp', lucide: 'code' },
  cxx: { id: 'cpp', lucide: 'code' },
  go: { id: 'go', lucide: 'code' },
  rs: { id: 'rust', lucide: 'code' },
  html: { id: 'html', lucide: 'code' },
  htm: { id: 'html', lucide: 'code' },
  css: { id: 'css', lucide: 'code' },
  png: { id: 'image', lucide: 'image' },
  jpg: { id: 'image', lucide: 'image' },
  jpeg: { id: 'image', lucide: 'image' },
  gif: { id: 'image', lucide: 'image' },
  webp: { id: 'image', lucide: 'image' },
  svg: { id: 'image', lucide: 'image' },
  bmp: { id: 'image', lucide: 'image' },
  avif: { id: 'image', lucide: 'image' },
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
  if (name === 'cargo.toml') return { id: 'rust', lucide: 'code' };
  if (name === 'readme' || name.startsWith('readme.')) return { id: 'readme', lucide: 'text' };
  const extension = name.includes('.') ? name.split('.').at(-1) : '';
  return EXTENSION_ICONS[extension] ?? { id: 'file', lucide: 'file' };
}
