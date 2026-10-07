import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const suites = Object.freeze({
  content: { emulator: 'firestore', projectId: 'demo-content-rules', test: 'tests/firestore/content.rules.test.mjs' },
  certification: { emulator: 'firestore', projectId: 'demo-certification-rules', test: 'tests/firestore/certification.rules.test.mjs' },
  projects: { emulator: 'firestore', projectId: 'demo-projects-rules', test: 'tests/firestore/projects.rules.test.mjs' },
  storage: { emulator: 'storage', projectId: 'demo-storage-rules', test: 'tests/storage/content.rules.test.mjs' },
});
const suiteName = process.argv[2];
const suite = suites[suiteName];
if (!suite) throw new Error(`Unknown Firebase rules suite: ${suiteName || '(missing)'}.`);

const root = fileURLToPath(new URL('..', import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), `ycoders-${suiteName}-rules-`));
const firebaseCli = fileURLToPath(new URL('../node_modules/firebase-tools/lib/bin/firebase.js', import.meta.url));
const testFile = join(root, suite.test);

const freePort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.unref();
  server.once('error', reject);
  server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
    const port = server.address().port;
    server.close(() => resolve(port));
  });
});
const port = await freePort();
const firebaseConfig = join(temporary, 'firebase.json');
writeFileSync(firebaseConfig, JSON.stringify({
  firestore: { rules: join(root, 'firestore.rules'), indexes: join(root, 'firestore.indexes.json') },
  storage: { rules: join(root, 'storage.rules') },
  emulators: { [suite.emulator]: { host: '127.0.0.1', port }, ui: { enabled: false } },
}));

const environment = { ...process.env };
for (const name of Object.keys(environment)) if (/(?:TOKEN|SECRET|CREDENTIAL|PASSWORD|COOKIE|API_KEY|PRIVATE_KEY|SERVICE_ACCOUNT|VERCEL_OIDC)/i.test(name)) delete environment[name];
delete environment.DEBUG;
Object.assign(environment, {
  FIREBASE_PROJECT_ID: suite.projectId,
  GCLOUD_PROJECT: suite.projectId,
  FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true',
  XDG_CONFIG_HOME: join(temporary, 'firebase-cli'),
  FIREBASE_RULES_TEST_PORT: String(port),
});
if (environment.JAVA_HOME) environment.PATH = `${join(environment.JAVA_HOME, 'bin')}${delimiter}${environment.PATH ?? ''}`;

const child = spawn(process.execPath, [firebaseCli, 'emulators:exec', '--only', suite.emulator, '--project', suite.projectId, '--config', firebaseConfig, `"${process.execPath}" "${testFile}"`], {
  cwd: root,
  env: environment,
  stdio: 'inherit',
  windowsHide: true,
});
console.log(`${suite.emulator} rules test using owned loopback port ${port} (launcher PID ${process.pid}, CLI PID ${child.pid}).`);
child.once('error', (error) => { throw error; });
child.once('exit', (code, signal) => {
  rmSync(temporary, { recursive: true, force: true });
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
