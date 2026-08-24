import { readFileSync } from 'node:fs';

const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const app = readFileSync('src/App.jsx', 'utf8');
const dashboard = readFileSync('src/dashboard/Dashboard.jsx', 'utf8');
if (firebase.storage?.rules !== 'storage.rules' || firebase.emulators?.storage?.port !== 9199) throw new Error('Storage rules/emulator are not configured.');
if (!pkg.scripts['validate:storage-security']) throw new Error('Storage security validation command is missing.');
if (!app.includes('parseAppRoute') || !app.includes("addEventListener('popstate'")) throw new Error('URL routing adapter is not wired.');
if (/setTimeout\(\(\)\s*=>\s*setIsLoading/.test(dashboard)) throw new Error('Dashboard still contains an artificial loading delay.');
console.log('Remediation Batch 5 structural validation passed.');
