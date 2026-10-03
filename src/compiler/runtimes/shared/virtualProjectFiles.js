const decoder = new TextDecoder();
const encoder = new TextEncoder();

export function safeVirtualPath(value, base = '') {
  const raw = String(value ?? '').replaceAll('\\', '/');
  if (!raw || raw.startsWith('/') || /^[a-z]:/i.test(raw) || raw.includes('\0')) throw new Error('Filesystem access is restricted to the project workspace.');
  const stack = base ? base.split('/').filter(Boolean) : [];
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!stack.length) throw new Error('Filesystem access is restricted to the project workspace.'); stack.pop(); }
    else stack.push(part);
  }
  if (!stack.length) throw new Error('A project file path is required.');
  return stack.join('/');
}

export function createVirtualProjectFiles(files = []) {
  const entries = new Map(files.map((file) => [safeVirtualPath(file.path), String(file.content ?? '')]));
  return {
    existsSync: (path) => entries.has(safeVirtualPath(path)),
    readFileSync(path, encoding) { const value = entries.get(safeVirtualPath(path)); if (value === undefined) { const error = new Error(`ENOENT: no such file, open '${path}'`); error.code = 'ENOENT'; throw error; } return encoding ? value : encoder.encode(value); },
    writeFileSync(path, value) { entries.set(safeVirtualPath(path), typeof value === 'string' ? value : decoder.decode(value)); },
    appendFileSync(path, value) { const safe = safeVirtualPath(path); entries.set(safe, (entries.get(safe) ?? '') + (typeof value === 'string' ? value : decoder.decode(value))); },
    unlinkSync(path) { const safe = safeVirtualPath(path); if (!entries.delete(safe)) { const error = new Error(`ENOENT: no such file, unlink '${path}'`); error.code = 'ENOENT'; throw error; } },
    mkdirSync() {},
    readdirSync(path = '.') { const prefix = path === '.' ? '' : `${safeVirtualPath(path)}/`; return [...new Set([...entries.keys()].filter((item) => item.startsWith(prefix)).map((item) => item.slice(prefix.length).split('/')[0]))]; },
    snapshot: () => [...entries].map(([path, content]) => ({ path, content, type: 'file', encoding: 'utf-8' })),
  };
}
