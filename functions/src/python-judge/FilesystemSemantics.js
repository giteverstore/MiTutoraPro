import { stat } from 'node:fs/promises';

// Existence is a metadata operation. Reading content is intentionally avoided:
// procfs/sysfs/cgroupfs entries may exist while being write-only or otherwise
// rejecting read(2). stat follows symlinks, matching the resolved-path behavior
// expected for the fixed judge-owned paths supplied by the worker.
export async function pathExists(path, { statPath = stat } = {}) {
  try {
    await statPath(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export async function writeRequiredControl(path, {
  pathExistsOperation = pathExists,
  writeControl,
  missingCode = 'CLEANUP_CGROUP_ALIVE',
} = {}) {
  if (typeof writeControl !== 'function') throw new TypeError('A control-file writer is required.');
  if (!await pathExistsOperation(path)) {
    throw Object.assign(new Error('Required control file is unavailable.'), { code: missingCode });
  }
  await writeControl(path, '1');
}
