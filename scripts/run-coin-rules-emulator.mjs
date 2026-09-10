import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = 'demo-local-coin-rules';
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const isolatedWorkingDirectory = mkdtempSync(join(tmpdir(), 'mi-tutora-coin-rules-'));
const firebaseCli = fileURLToPath(new URL('../node_modules/firebase-tools/lib/bin/firebase.js', import.meta.url));
const firebaseConfig = fileURLToPath(new URL('../firebase.json', import.meta.url));
const testFile = fileURLToPath(new URL('../tests/firestore/coin.rules.test.mjs', import.meta.url));
const rulesFile = fileURLToPath(new URL('../firestore.rules', import.meta.url));
const environment = { ...process.env };
for (const name of Object.keys(environment)) {
  if (/(?:TOKEN|SECRET|CREDENTIAL|PASSWORD|COOKIE|API_KEY|PRIVATE_KEY|SERVICE_ACCOUNT|VERCEL_OIDC)/i.test(name)) delete environment[name];
}
delete environment.DEBUG;
Object.assign(environment, {
  NODE_ENV: 'test',
  FIREBASE_PROJECT_ID: PROJECT_ID,
  GCLOUD_PROJECT: PROJECT_ID,
  COIN_RULES_PATH: rulesFile,
  FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true',
  INIT_CWD: projectRoot,
});

const child = spawn(process.execPath, [
  firebaseCli, 'emulators:exec', '--only', 'firestore', '--project', PROJECT_ID, '--config', firebaseConfig,
  `"${process.execPath}" "${testFile}"`,
], { cwd: isolatedWorkingDirectory, env: environment, stdio: 'inherit' });

child.on('error', (error) => { throw error; });
child.on('exit', (code, signal) => {
  if (isolatedWorkingDirectory.toLowerCase().startsWith(tmpdir().toLowerCase())) rmSync(isolatedWorkingDirectory, { recursive: true, force: true });
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
