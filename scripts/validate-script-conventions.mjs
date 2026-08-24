import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const failures = [];
for (const [name, command] of Object.entries(pkg.scripts)) {
  if (!/^(validate|test):/.test(name)) continue;
  const file = command.match(/node scripts\/([^\s"]+)/)?.[1];
  if (file) {
    try { await access(resolve(root, 'scripts', file)); } catch { failures.push(`${name} references missing scripts/${file}`); }
  }
  if (name.startsWith('validate:') && file?.startsWith('test-')) failures.push(`${name} directly references a test-* script.`);
  if (name.startsWith('test:') && file?.startsWith('validate-')) failures.push(`${name} directly references a validate-* script.`);
}
if (!pkg.scripts['validate:course'].includes('validate:python-course') || !pkg.scripts['validate:course'].includes('validate:java-course')) {
  failures.push('validate:course must orchestrate every registered production course validator.');
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Validator command convention passed (${Object.keys(pkg.scripts).filter((name) => /^(validate|test):/.test(name)).length} commands).`);
