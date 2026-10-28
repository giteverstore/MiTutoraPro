import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const IMPORT_PATTERN = /@import\s+['"]([^'"]+)['"]\s*;/g;

export function readStylesheetGraph(path) {
  const absolutePath = resolve(path);
  const source = readFileSync(absolutePath, 'utf8');
  const imports = [...source.matchAll(IMPORT_PATTERN)];
  if (!imports.length) return source;

  return imports
    .map((match) => readStylesheetGraph(resolve(dirname(absolutePath), match[1])))
    .join('\n');
}
