import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = 'demo-mitutora';
const REQUIRED_PORTS = Object.freeze([
  { name: 'Firestore', port: 8080 },
  { name: 'Auth', port: 9099 },
]);
const root = fileURLToPath(new URL('..', import.meta.url));
const firebaseCli = fileURLToPath(new URL('../node_modules/firebase-tools/lib/bin/firebase.js', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), 'ycoders-e2e-firebase-'));
const ownershipDirectory = join(root, '.tmp-firebase-config');
const ownershipFile = join(ownershipDirectory, 'playwright-emulator-owner.json');

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(() => resolve(true)));
  });
}

async function assertPortsAreUnowned() {
  for (const { name, port } of REQUIRED_PORTS) {
    if (!await portIsFree(port)) {
      throw new Error(`${name} emulator port ${port} is already occupied. Refusing to attach to an emulator not owned by this E2E run.`);
    }
  }
}

async function waitForReadiness(child, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`Firebase emulator process exited before readiness (code ${child.exitCode}).`);
    try {
      const [auth, firestore] = await Promise.all([
        fetch('http://127.0.0.1:9099/').catch(() => null),
        fetch(`http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents?pageSize=1`).catch(() => null),
      ]);
      if (auth && firestore) return;
    } catch { /* retry until the bounded deadline */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Firebase emulator readiness timed out after 120000ms (Auth 9099, Firestore 8080).');
}

const environment = { ...process.env };
for (const name of Object.keys(environment)) {
  if (/(?:TOKEN|SECRET|CREDENTIAL|PASSWORD|COOKIE|API_KEY|PRIVATE_KEY|SERVICE_ACCOUNT|VERCEL_OIDC)/i.test(name)) delete environment[name];
}
Object.assign(environment, {
  FIREBASE_PROJECT_ID: PROJECT_ID,
  GCLOUD_PROJECT: PROJECT_ID,
  FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true',
  XDG_CONFIG_HOME: temporary,
});
if (environment.JAVA_HOME) environment.PATH = `${join(environment.JAVA_HOME, 'bin')}${delimiter}${environment.PATH ?? ''}`;

await assertPortsAreUnowned();
const child = spawn(process.execPath, [
  firebaseCli,
  'emulators:start',
  '--only', 'auth,firestore',
  '--project', PROJECT_ID,
], { cwd: root, env: environment, stdio: 'inherit', windowsHide: true });
mkdirSync(ownershipDirectory, { recursive: true });
writeFileSync(ownershipFile, JSON.stringify({ ownerPid: process.pid, childPid: child.pid, projectId: PROJECT_ID }), 'utf8');

let closing = false;
async function close(exitCode = 0) {
  if (closing) return;
  closing = true;
  if (child.pid && child.exitCode == null) {
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      child.kill('SIGINT');
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
      if (child.exitCode == null) child.kill('SIGKILL');
    }
  }
  rmSync(temporary, { recursive: true, force: true });
  rmSync(ownershipFile, { force: true });
  process.exit(exitCode);
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, () => void close(0));
child.once('error', (error) => {
  console.error(`Firebase emulator process could not start: ${error.message}`);
  void close(1);
});
child.once('exit', (code, signal) => {
  if (!closing) {
    console.error(`Firebase emulator process exited unexpectedly (code ${code ?? 'none'}, signal ${signal ?? 'none'}).`);
    void close(code ?? 1);
  }
});

try {
  await waitForReadiness(child);
  console.log(`Firebase E2E emulators ready for ${PROJECT_ID}: Auth 9099, Firestore 8080 (owner PID ${child.pid}).`);
} catch (error) {
  console.error(error.message);
  await close(1);
}

process.stdin.resume();
