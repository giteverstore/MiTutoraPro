import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const entry = path.join(sourceRoot, 'styles', 'index.css');
const visited = new Set();
const active = new Set();
const importedBy = new Map();

async function visit(file) {
  const resolved = path.resolve(file);
  assert(!active.has(resolved), `Circular CSS import detected at ${path.relative(root, resolved)}`);
  if (visited.has(resolved)) return;
  active.add(resolved);
  const css = await readFile(resolved, 'utf8');
  const imports = [...css.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g)]
    .map((match) => match[1])
    .filter((specifier) => !/^https?:/i.test(specifier));
  for (const specifier of imports) {
    const target = path.resolve(path.dirname(resolved), specifier);
    await access(target);
    const owners = importedBy.get(target) ?? [];
    owners.push(resolved);
    importedBy.set(target, owners);
    await visit(target);
  }
  active.delete(resolved);
  visited.add(resolved);
}

await visit(entry);

const duplicates = [...importedBy.entries()].filter(([, owners]) => owners.length > 1);
assert.equal(duplicates.length, 0, `Duplicate CSS imports: ${duplicates.map(([file]) => path.relative(root, file)).join(', ')}`);

const main = await readFile(path.join(sourceRoot, 'main.jsx'), 'utf8');
assert.equal((main.match(/import ['"]\.\/styles\/index\.css['"]/g) ?? []).length, 1, 'main.jsx must import styles/index.css exactly once');
assert(!main.includes("import './styles.css'"), 'The removed monolithic stylesheet must not remain imported');

let legacyExists = true;
try { await access(path.join(sourceRoot, 'styles.css')); } catch { legacyExists = false; }
assert.equal(legacyExists, false, 'src/styles.css must remain removed');

process.stdout.write(`CSS architecture validation passed (${visited.size} stylesheets resolved; no duplicate or circular imports).\n`);
