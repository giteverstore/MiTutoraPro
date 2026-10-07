import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ownershipDirectory = join(process.cwd(), '.tmp-firebase-config');
const ownershipFiles = [
  join(ownershipDirectory, 'playwright-preview-owner.json'),
  join(ownershipDirectory, 'playwright-emulator-owner.json'),
];
const diagnostics = process.env.E2E_TEARDOWN_DIAGNOSTICS === 'true';

function listeningPids() {
  const output = execFileSync('netstat.exe', ['-ano', '-p', 'TCP'], { encoding: 'utf8', windowsHide: true });
  const listeners = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = line.trim().match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i);
    if (match) listeners.set(Number(match[1]), Number(match[2]));
  }
  return listeners;
}

async function stopVerifiedListener(port, pid) {
  const owner = listeningPids().get(port);
  if (!owner) return;
  if (owner !== pid) throw new Error(`E2E port ${port} is now owned by PID ${owner}, not recorded PID ${pid}; refusing to stop it.`);
  if (diagnostics) console.log(`[e2e teardown] stopping listener ${port} (PID ${pid})`);
  try { process.kill(pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (listeningPids().get(port) !== pid) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`E2E listener ${port} (PID ${pid}) did not stop within five seconds.`);
}

async function stopOwnedProcess(file) {
  let record;
  try {
    record = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return;
  }

  if (diagnostics) console.log(`[e2e teardown] stopping ${file}`);
  if (process.platform === 'win32') {
    if (record.port) await stopVerifiedListener(Number(record.port), Number(record.ownerPid));
    if (record.listenerPids) {
      for (const port of [8080, 9099]) await stopVerifiedListener(port, Number(record.listenerPids[port]));
    }
  } else {
    const pid = Number(record.childPid ?? record.ownerPid);
    if (Number.isInteger(pid) && pid > 0) {
      try { process.kill(pid, 'SIGTERM'); } catch { /* already stopped */ }
    }
  }
  rmSync(file, { force: true });
  if (diagnostics) console.log(`[e2e teardown] finished ${file}`);
}

export default async function teardownE2EServers() {
  if (diagnostics) console.log('[e2e teardown] started');
  for (const file of ownershipFiles) await stopOwnedProcess(file);
  if (diagnostics) console.log('[e2e teardown] complete');
}
