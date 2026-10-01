import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ownershipDirectory = join(process.cwd(), '.tmp-firebase-config');
const ownershipFiles = [
  join(ownershipDirectory, 'playwright-preview-owner.json'),
  join(ownershipDirectory, 'playwright-emulator-owner.json'),
];

function stopOwnedProcess(file) {
  let record;
  try {
    record = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return;
  }

  const pid = Number(record.childPid ?? record.ownerPid);
  if (Number.isInteger(pid) && pid > 0) {
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      try { process.kill(pid, 'SIGTERM'); } catch { /* already stopped */ }
    }
  }
  rmSync(file, { force: true });
}

export default async function teardownE2EServers() {
  for (const file of ownershipFiles) stopOwnedProcess(file);
}
