const MAX_PATH_LENGTH = 120;
const EXTENSIONS = Object.freeze({
  python: ['.py', '.txt', '.md', '.json'],
  javascript: ['.js', '.mjs', '.json', '.txt', '.md'],
  typescript: ['.ts', '.json', '.txt', '.md'],
  java: ['.java', '.txt', '.md'],
  c: ['.c', '.h', '.txt', '.md'],
  cpp: ['.cpp', '.cc', '.h', '.hpp', '.txt', '.md'],
});

export function normalizeProjectPath(value) {
  const path = String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//, '');
  if (!path || path.length > MAX_PATH_LENGTH || path.startsWith('/') || /^[a-z]:/i.test(path)) return null;
  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || !/^[\w .@+-]+$/.test(part))) return null;
  return parts.join('/');
}

export function languageForPath(path, fallback = 'plaintext') {
  const extension = `.${String(path).split('.').at(-1)?.toLowerCase()}`;
  return ({ '.py': 'python', '.js': 'javascript', '.mjs': 'javascript', '.ts': 'typescript', '.java': 'java', '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.hpp': 'cpp', '.json': 'json', '.md': 'markdown', '.txt': 'plaintext' })[extension] ?? fallback;
}

export function validateProjectFilePath(value, files, projectLanguage) {
  const path = normalizeProjectPath(value);
  if (!path) return { valid: false, error: 'Enter a safe relative file path (maximum 120 characters).' };
  if (files[path]) return { valid: false, error: 'A file with that path already exists.' };
  const allowed = EXTENSIONS[projectLanguage] ?? [];
  const extension = path.includes('.') ? `.${path.split('.').at(-1).toLowerCase()}` : '';
  if (allowed.length && !allowed.includes(extension)) return { valid: false, error: `Use one of: ${allowed.join(', ')}` };
  return { valid: true, path };
}

export function validateProjectFolderPath(value, files, folders = []) {
  const path = normalizeProjectPath(value);
  if (!path) return { valid: false, error: 'Enter a safe relative folder path (maximum 120 characters).' };
  if (files[path] || folders.includes(path)) return { valid: false, error: 'A file or folder with that path already exists.' };
  return { valid: true, path };
}

export function buildProjectTree(files, explicitFolders = []) {
  const root = { type: 'root', path: '', children: [] };
  const folders = new Map([['', root]]);
  const ensureFolder = (path) => {
    if (!path || folders.has(path)) return folders.get(path || '');
    const parts = path.split('/');
    const parentPath = parts.slice(0, -1).join('/');
    const parent = ensureFolder(parentPath);
    const node = { type: 'folder', name: parts.at(-1), path, children: [] };
    folders.set(path, node); parent.children.push(node); return node;
  };
  explicitFolders.forEach(ensureFolder);
  Object.keys(files).forEach((path) => {
    const parts = path.split('/');
    const parent = ensureFolder(parts.slice(0, -1).join('/'));
    parent.children.push({ type: 'file', name: parts.at(-1), path });
  });
  const sort = (node) => { node.children.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1)); node.children.filter(({ type }) => type === 'folder').forEach(sort); };
  sort(root); return root;
}

export function createInitialProjectFiles(project, savedProgress) {
  const entryFilePath = savedProgress.entryFilePath || project.template.sourcePath;
  if (savedProgress.files && typeof savedProgress.files === 'object' && Object.keys(savedProgress.files).length) {
    return { files: savedProgress.files, folders: savedProgress.folders ?? [], entryFilePath: savedProgress.files[entryFilePath] ? entryFilePath : Object.keys(savedProgress.files)[0] };
  }
  return {
    entryFilePath,
    folders: [], files: { [entryFilePath]: { path: entryFilePath, content: savedProgress.submission ?? project.starterCode, language: project.language, editable: true } },
  };
}

export const supportsMultiFileProjectExecution = () => false;
