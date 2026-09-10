import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = 'demo-local-coin-ledger';
const emulatorHost = String(process.env.FIRESTORE_EMULATOR_HOST || '').trim();
const environment = { ...process.env };
for (const name of Object.keys(environment)) {
  if (/(?:TOKEN|SECRET|CREDENTIAL|PASSWORD|COOKIE|API_KEY|PRIVATE_KEY|SERVICE_ACCOUNT|VERCEL_OIDC)/i.test(name)) delete environment[name];
}
delete environment.DEBUG;
Object.assign(environment, {
  NODE_ENV: 'test',
  FIREBASE_PROJECT_ID: PROJECT_ID,
  GCLOUD_PROJECT: PROJECT_ID,
  COIN_LEDGER_EMULATOR_TEST: 'true',
  FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true',
});

if (!emulatorHost) {
  const isolatedWorkingDirectory = mkdtempSync(join(tmpdir(), 'mi-tutora-coin-emulator-'));
  const firebaseCli = fileURLToPath(new URL('../node_modules/firebase-tools/lib/bin/firebase.js', import.meta.url));
  const firebaseConfig = fileURLToPath(new URL('../firebase.json', import.meta.url));
  const runner = fileURLToPath(import.meta.url);
  try {
    const child = spawnSync(process.execPath, [
      firebaseCli, 'emulators:exec', '--only', 'firestore', '--project', PROJECT_ID, '--config', firebaseConfig,
      `"${process.execPath}" "${runner}"`,
    ], { cwd: isolatedWorkingDirectory, env: environment, stdio: 'inherit' });
    if (child.error) throw child.error;
    if (child.signal) process.kill(process.pid, child.signal);
    process.exitCode = child.status ?? 1;
  } finally {
    if (isolatedWorkingDirectory.toLowerCase().startsWith(tmpdir().toLowerCase())) rmSync(isolatedWorkingDirectory, { recursive: true, force: true });
  }
} else {
  const vitestPath = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
  const child = spawnSync(process.execPath, [vitestPath, 'run', '--config', 'vitest.coins.config.js', '--maxWorkers=1'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), env: environment, stdio: 'inherit',
  });
  if (child.error) throw child.error;
  if (child.signal) process.kill(process.pid, child.signal);
  process.exitCode = child.status ?? 1;
}
