import { constants } from 'node:fs';
import { isAbsolute } from 'node:path';

export const JAILER_RUNTIME_UID = 1001;
export const JAILER_RUNTIME_GID = 1001;
export const JAILER_STDERR_CLASSIFICATION_BYTES = 4 * 1024;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;

function contractFailure(reasonCode) {
  return Object.assign(new Error('Jailer launch contract is invalid.'), {
    code: 'guest/worker-command',
    executionReasonCode: reasonCode,
  });
}

export function buildJailerInvocation({ jailerPath, firecrackerPath, id, chrootBase }) {
  if (!SAFE_ID.test(id)
    || !isAbsolute(jailerPath)
    || !isAbsolute(firecrackerPath)
    || !isAbsolute(chrootBase)) {
    throw contractFailure('judge/jailer-invalid-arguments');
  }
  return Object.freeze({
    file: jailerPath,
    args: Object.freeze([
      '--id', id,
      '--exec-file', firecrackerPath,
      '--uid', String(JAILER_RUNTIME_UID),
      '--gid', String(JAILER_RUNTIME_GID),
      '--chroot-base-dir', chrootBase,
      '--new-pid-ns',
      '--daemonize',
      '--cgroup-version', '2',
      '--', '--api-sock', '/run/firecracker.socket',
    ]),
  });
}

export async function validateJailerLaunchContract(invocation, operations) {
  const { stat, access } = operations ?? {};
  if (typeof stat !== 'function' || typeof access !== 'function') {
    throw contractFailure('judge/jailer-invalid-arguments');
  }
  const values = new Map();
  for (let index = 0; index < invocation.args.length - 1; index += 1) {
    const value = invocation.args[index + 1];
    if (invocation.args[index].startsWith('--')) values.set(invocation.args[index], value);
  }
  const execFile = values.get('--exec-file');
  const chrootBase = values.get('--chroot-base-dir');
  if (!SAFE_ID.test(values.get('--id') ?? '')
    || values.get('--uid') !== String(JAILER_RUNTIME_UID)
    || values.get('--gid') !== String(JAILER_RUNTIME_GID)
    || values.get('--cgroup-version') !== '2'
    || !invocation.args.includes('--new-pid-ns')
    || !invocation.args.includes('--daemonize')) {
    throw contractFailure('judge/jailer-invalid-arguments');
  }
  for (const path of [invocation.file, execFile]) {
    let metadata;
    try {
      metadata = await stat(path);
      await access(path, constants.X_OK);
    } catch {
      throw contractFailure('judge/jailer-exec-file-invalid');
    }
    if (!metadata.isFile() || metadata.uid !== 0 || (metadata.mode & 0o022) !== 0) {
      throw contractFailure('judge/jailer-exec-file-invalid');
    }
  }
  let chroot;
  try { chroot = await stat(chrootBase); }
  catch { throw contractFailure('judge/jailer-chroot-failed'); }
  if (!chroot.isDirectory() || chroot.uid !== 0 || (chroot.mode & 0o022) !== 0) {
    throw contractFailure('judge/jailer-chroot-failed');
  }
  return true;
}

export function classifyJailerStderr(value) {
  const text = Buffer.isBuffer(value)
    ? value.subarray(0, JAILER_STDERR_CLASSIFICATION_BYTES).toString('utf8')
    : String(value ?? '').slice(0, JAILER_STDERR_CLASSIFICATION_BYTES);
  if (/failed to parse arguments|invalid.*argument|unknown argument|unexpected argument/iu.test(text)) return 'judge/jailer-invalid-arguments';
  if (/permission denied|operation not permitted|failed to change (?:owner|permissions)/iu.test(text)) return 'judge/jailer-permission-denied';
  if (/cgroup|controller .* unavailable|failed to move process/iu.test(text)) return 'judge/jailer-cgroup-failed';
  if (/chroot|pivot_root|new root|failed to create directory/iu.test(text)) return 'judge/jailer-chroot-failed';
  if (/namespace|failed cloning|unshare|setns/iu.test(text)) return 'judge/jailer-namespace-failed';
  if (/failed to canonicalize.*firecracker|not a file|exec-file/iu.test(text)) return 'judge/jailer-exec-file-invalid';
  if (/failed to exec|exec format|could not execute/iu.test(text)) return 'judge/jailer-exec-failed';
  return 'judge/jailer-unknown-startup-failure';
}

export function jailerStartupFailure(exitCode, signal, stderr) {
  return Object.assign(new Error('Jailer startup failed.'), {
    code: signal ? 'guest/timeout' : 'guest/worker-command',
    exitCode: Number.isInteger(exitCode) ? exitCode : null,
    signal: null,
    executionReasonCode: classifyJailerStderr(stderr),
  });
}
