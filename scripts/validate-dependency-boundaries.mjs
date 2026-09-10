import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (pkg.dependencies?.['firebase-admin']) throw new Error('firebase-admin must not be a browser production dependency.');
if (!pkg.devDependencies?.['firebase-admin']) throw new Error('Publishing tooling requires firebase-admin in root devDependencies.');
if (!pkg.dependencies?.['@google-cloud/firestore']) throw new Error('@google-cloud/firestore must be an explicit server runtime dependency.');
if (!pkg.dependencies?.['google-auth-library']) throw new Error('google-auth-library must be an explicit server runtime dependency.');
if (!pkg.dependencies?.['@vercel/oidc']) throw new Error('@vercel/oidc must be an explicit server runtime dependency.');
const tracked = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' });
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', 'src'], { encoding: 'utf8' });
const files = [...new Set(`${tracked}\n${untracked}`.split(/\r?\n/))]
  .filter((file) => /\.[cm]?[jt]sx?$/.test(file));
const serverDependencyPattern = /(?:from\s+|import\s*\()(['"])(?:firebase-admin|@google-cloud\/firestore|google-auth-library|@vercel\/oidc|[^'"]*server\/(?:ai\/quota|auth)[^'"]*)\1/;
const offenders = files.filter((file) => serverDependencyPattern.test(readFileSync(file, 'utf8')));
if (offenders.length) throw new Error(`Browser source imports a server-only Firebase dependency: ${offenders.join(', ')}`);
console.log(`Dependency boundary validation passed (${files.length} browser source files inspected).`);
