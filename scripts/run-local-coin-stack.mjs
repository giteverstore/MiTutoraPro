import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const projectId = 'demo-mitutora-coins';
const isolatedDirectory = mkdtempSync(join(tmpdir(), 'mi-tutora-full-stack-'));
const firebaseCli = fileURLToPath(new URL('../node_modules/firebase-tools/lib/bin/firebase.js', import.meta.url));
const viteCli = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const seed = fileURLToPath(new URL('./seed-local-coin-development.mjs', import.meta.url));
const config = fileURLToPath(new URL('../firebase.json', import.meta.url));
const environment = { ...process.env };
for (const name of Object.keys(environment)) {
  if (/(?:TOKEN|SECRET|CREDENTIAL|PASSWORD|COOKIE|API_KEY|PRIVATE_KEY|SERVICE_ACCOUNT|VERCEL_OIDC)/i.test(name)) delete environment[name];
}
Object.assign(environment, {
  NODE_ENV: 'development', LOCAL_COIN_FULL_STACK: 'true', FIREBASE_PROJECT_ID: projectId,
  LOCAL_SUBSCRIPTION_GRANTS: 'true',
  AI_TUTOR_ENABLED: 'false', AI_TUTOR_ROLLOUT_PERCENTAGE: '0',
  GCLOUD_PROJECT: projectId, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', STORAGE_EMULATOR_HOST: 'http://127.0.0.1:9199',
  VITE_FIREBASE_USE_EMULATORS: 'true', VITE_FIREBASE_PROJECT_ID: projectId,
  VITE_FIREBASE_API_KEY: 'local-emulator-key', VITE_FIREBASE_AUTH_DOMAIN: 'localhost',
  VITE_FIREBASE_STORAGE_BUCKET: `${projectId}.appspot.com`, VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:local', VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
  VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: '127.0.0.1', VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: '8080',
  VITE_FIREBASE_FUNCTIONS_EMULATOR: 'true',
  VITE_FIREBASE_STORAGE_EMULATOR: 'true', VITE_FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1',
  VITE_FIREBASE_STORAGE_EMULATOR_PORT: '9199', VITE_ENABLE_LOCAL_CHALLENGE_FALLBACK: 'false',
  VITE_ENABLE_LOCAL_COURSE_FALLBACK: 'true',
  FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true',
});
const androidStudioJava = 'C:\\Program Files\\Android\\Android Studio\\jbr\\bin';
if (process.platform === 'win32' && existsSync(androidStudioJava)) {
  const pathKey = Object.keys(environment).find((name) => name.toLowerCase() === 'path') ?? 'Path';
  environment[pathKey] = `${androidStudioJava};${environment[pathKey] || ''}`;
}

const children = [];
function run(command, args, options = {}) {
  const child = spawn(command, args, { env: environment, stdio: 'inherit', ...options });
  children.push(child);
  return child;
}
function waitForPort(port, timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started >= timeoutMs) reject(new Error(`Emulator port ${port} did not become ready.`));
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}
function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => signal ? reject(new Error(`Process stopped by ${signal}.`)) : resolve(code ?? 1));
  });
}
async function cleanup() {
  if (process.platform === 'win32') {
    for (const child of children) {
      if (child.pid && child.exitCode == null) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    }
  }
  const exits = children.filter((child) => child.exitCode == null).map((child) => new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill();
    setTimeout(resolve, 5_000);
  }));
  await Promise.all(exits);
  if (isolatedDirectory.toLowerCase().startsWith(tmpdir().toLowerCase())) {
    try { rmSync(isolatedDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* process exit releases any remaining emulator handle */ }
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await cleanup(); process.exit(0); });

try {
  const emulators = run(process.execPath, [firebaseCli, 'emulators:start', '--only', 'auth,firestore,storage,functions', '--project', projectId, '--config', config], { cwd: isolatedDirectory });
  await Promise.all([waitForPort(9099), waitForPort(8080), waitForPort(9199), waitForPort(5001)]);
  const seeder = run(process.execPath, [seed], { cwd: root });
  if (await waitForExit(seeder) !== 0) throw new Error('Local development seed failed.');
  const vite = run(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', '5173'], { cwd: root });
  const result = await Promise.race([waitForExit(vite), waitForExit(emulators)]);
  process.exitCode = result;
} finally {
  await cleanup();
}
