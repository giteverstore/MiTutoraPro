import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'ycoders-phase12-live-'));
const firebaseCli = fileURLToPath(new URL('../../node_modules/firebase-tools/lib/bin/firebase.js', import.meta.url));
const testFile = fileURLToPath(new URL('../../tests/content-contracts/phase-12-live.emulator.mjs', import.meta.url));
const projectId = 'demo-mitutora';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

const [auth, firestore, storage] = await Promise.all([freePort(), freePort(), freePort()]);
if (new Set([auth, firestore, storage]).size !== 3) throw new Error('Emulator ports must be distinct.');
const config = join(temporary, 'firebase.json');
writeFileSync(config, JSON.stringify({
  firestore: { rules: join(root, 'firestore.rules'), indexes: join(root, 'firestore.indexes.json') },
  storage: { rules: join(root, 'storage.rules') },
  emulators: {
    auth: { host: '127.0.0.1', port: auth },
    firestore: { host: '127.0.0.1', port: firestore },
    storage: { host: '127.0.0.1', port: storage },
    ui: { enabled: false },
  },
}));
const environment = { ...process.env };
for (const name of Object.keys(environment)) if (/(?:TOKEN|SECRET|CREDENTIAL|PASSWORD|COOKIE|API_KEY|PRIVATE_KEY|SERVICE_ACCOUNT|VERCEL_OIDC)/i.test(name)) delete environment[name];
delete environment.DEBUG;
Object.assign(environment, {
  FIREBASE_PROJECT_ID: projectId, GCLOUD_PROJECT: projectId,
  FIRESTORE_EMULATOR_HOST: `127.0.0.1:${firestore}`,
  FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${auth}`,
  STORAGE_EMULATOR_HOST: `http://127.0.0.1:${storage}`,
  VITE_FIREBASE_API_KEY: 'phase12-emulator-only',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-mitutora.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: projectId,
  VITE_FIREBASE_STORAGE_BUCKET: 'demo-mitutora.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  VITE_FIREBASE_APP_ID: '1:1234567890:web:phase12emulator',
  VITE_FIREBASE_USE_EMULATORS: 'true',
  VITE_FIREBASE_AUTH_EMULATOR_URL: `http://127.0.0.1:${auth}`,
  VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: '127.0.0.1',
  VITE_FIREBASE_FIRESTORE_EMULATOR_PORT: String(firestore),
  VITE_FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1',
  VITE_FIREBASE_STORAGE_EMULATOR_PORT: String(storage),
  FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true',
  XDG_CONFIG_HOME: join(temporary, 'firebase-cli'),
});
if (environment.JAVA_HOME) environment.PATH = `${join(environment.JAVA_HOME, 'bin')}${delimiter}${environment.PATH ?? ''}`;
const command = `"${process.execPath}" "${testFile}"`;
const child = spawn(process.execPath, [firebaseCli, 'emulators:exec', '--only', 'auth,firestore,storage', '--project', projectId, '--config', config, command], {
  cwd: root, env: environment, stdio: 'inherit', windowsHide: true,
});
console.log(`Phase 12 owned emulators: Auth ${auth}, Firestore ${firestore}, Storage ${storage}; launcher PID ${process.pid}, CLI PID ${child.pid}.`);
child.once('error', (error) => { throw error; });
child.once('exit', (code, signal) => {
  rmSync(temporary, { recursive: true, force: true });
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
