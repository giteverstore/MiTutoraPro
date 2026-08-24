import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (pkg.dependencies?.['firebase-admin']) throw new Error('firebase-admin must not be a browser production dependency.');
if (!pkg.devDependencies?.['firebase-admin']) throw new Error('Publishing tooling requires firebase-admin in root devDependencies.');
const files = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' }).split(/\r?\n/).filter((file) => /\.[cm]?[jt]sx?$/.test(file));
const offenders = files.filter((file) => /(?:from\s+|import\s*\()(['"])firebase-admin(?:\/[^'"]*)?\1/.test(readFileSync(file, 'utf8')));
if (offenders.length) throw new Error(`Browser source imports firebase-admin: ${offenders.join(', ')}`);
console.log(`Dependency boundary validation passed (${files.length} browser source files inspected).`);
