const MAX_FILES = 128;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
const textEncoder = new TextEncoder();

export const PROJECT_RUNTIME_ARTIFACTS = Object.freeze([
  /(^|\/)__pycache__(\/|$)/, /\.py[co]$/, /\.class$/,
  /(^|\/)(?:app|a\.out|main\.wasm)$/, /\.(?:o|obj|wasm|map)$/,
  /(^|\/)\.cache(\/|$)/, /(^|\/)tmp(\/|$)/,
]);

export function normalizeProjectFilePath(value) {
  const path = String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+/g, '/');
  if (!path || path.startsWith('/') || /^[a-z]:/i.test(path) || path.includes('\0')) throw new TypeError('Project file paths must be safe relative paths.');
  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) throw new TypeError('Project file paths cannot escape the project root.');
  return parts.join('/');
}

export const isProjectRuntimeArtifact = (path) => PROJECT_RUNTIME_ARTIFACTS.some((pattern) => pattern.test(path));

export function normalizeProjectFileSnapshot(files, { filterArtifacts = true } = {}) {
  const entries = Array.isArray(files) ? files.map((file) => [file.path, file]) : Object.entries(files ?? {});
  if (entries.length > MAX_FILES) throw new RangeError(`Project workspaces support at most ${MAX_FILES} files.`);
  let totalBytes = 0;
  const snapshot = {};
  for (const [rawPath, rawFile] of entries) {
    const path = normalizeProjectFilePath(rawPath);
    if (filterArtifacts && isProjectRuntimeArtifact(path)) continue;
    const content = typeof rawFile === 'string' ? rawFile : String(rawFile?.content ?? '');
    const bytes = textEncoder.encode(content).byteLength;
    if (bytes > MAX_FILE_BYTES) throw new RangeError(`${path} exceeds the project file limit.`);
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_BYTES) throw new RangeError('Project workspace exceeds the total file limit.');
    snapshot[path] = { path, type: 'file', encoding: 'utf-8', content, editable: rawFile?.editable !== false, ...(rawFile?.language ? { language: rawFile.language } : {}) };
  }
  return snapshot;
}

export function diffProjectFileSnapshots(beforeFiles, afterFiles) {
  const before = normalizeProjectFileSnapshot(beforeFiles);
  const after = normalizeProjectFileSnapshot(afterFiles);
  const mutations = [];
  Object.entries(after).forEach(([path, file]) => {
    if (!before[path]) mutations.push({ type: 'created', path, file });
    else if (before[path].content !== file.content) mutations.push({ type: 'modified', path, file });
  });
  Object.keys(before).filter((path) => !after[path]).forEach((path) => mutations.push({ type: 'deleted', path }));
  return mutations;
}

export function mergeProjectExecutionSnapshot(editorFiles, mountedFiles, resultingFiles) {
  const editor = normalizeProjectFileSnapshot(editorFiles);
  const mounted = normalizeProjectFileSnapshot(mountedFiles);
  const resulting = normalizeProjectFileSnapshot(resultingFiles);
  const next = { ...editor };
  for (const mutation of diffProjectFileSnapshots(mounted, resulting)) {
    if (mutation.type === 'deleted') delete next[mutation.path];
    else next[mutation.path] = { ...next[mutation.path], ...mutation.file };
  }
  return { files: next, mutations: diffProjectFileSnapshots(editor, next) };
}

export function serializeProjectFiles(files) {
  return Object.values(normalizeProjectFileSnapshot(files)).map(({ path, content, encoding }) => ({ path, content, type: 'file', encoding }));
}
