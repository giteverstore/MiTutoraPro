import { describe, expect, it } from 'vitest';
import { executionFailure, sanitizedExecutionDiagnostic } from '../../functions/src/python-judge/ExecutionDiagnostics.js';
import {
  buildJailerInvocation,
  classifyJailerStderr,
  JAILER_RUNTIME_GID,
  JAILER_RUNTIME_UID,
  JAILER_STDERR_CLASSIFICATION_BYTES,
  jailerStartupFailure,
  validateJailerLaunchContract,
} from '../../functions/src/python-judge/JailerLaunchContract.js';

const input = Object.freeze({
  jailerPath: '/opt/mitutora-judge/bin/jailer',
  firecrackerPath: '/opt/mitutora-judge/bin/firecracker',
  id: 'safe-execution-1',
  chrootBase: '/srv/mitutora-judge/executions/safe-execution-1/jailer',
});

const regularFile = Object.freeze({ isFile: () => true, isDirectory: () => false, uid: 0, mode: 0o100555 });
const secureDirectory = Object.freeze({ isFile: () => false, isDirectory: () => true, uid: 0, mode: 0o40755 });

function operations({ missingChroot = false, writableBinary = false } = {}) {
  return {
    stat: async (path) => {
      if (path === input.chrootBase) {
        if (missingChroot) throw Object.assign(new Error('absent'), { code: 'ENOENT' });
        return secureDirectory;
      }
      return writableBinary ? { ...regularFile, mode: 0o100777 } : regularFile;
    },
    access: async () => {},
  };
}

describe('Firecracker jailer launch contract', () => {
  it('builds the exact shell-free invocation shape', () => {
    const invocation = buildJailerInvocation(input);
    expect(invocation.file).toBe(input.jailerPath);
    expect(invocation.args).toEqual([
      '--id', input.id,
      '--exec-file', input.firecrackerPath,
      '--uid', String(JAILER_RUNTIME_UID),
      '--gid', String(JAILER_RUNTIME_GID),
      '--chroot-base-dir', input.chrootBase,
      '--new-pid-ns', '--daemonize', '--cgroup-version', '2',
      '--', '--api-sock', '/run/firecracker.socket',
    ]);
    expect(invocation).not.toHaveProperty('shell');
    expect(Object.isFrozen(invocation.args)).toBe(true);
  });

  it.each([
    [{ ...input, id: '../unsafe' }],
    [{ ...input, jailerPath: 'relative/jailer' }],
    [{ ...input, firecrackerPath: 'firecracker' }],
    [{ ...input, chrootBase: 'relative/jail' }],
  ])('rejects structurally unsafe invocation input', (candidate) => {
    expect(() => buildJailerInvocation(candidate)).toThrow('Jailer launch contract is invalid.');
  });

  it('accepts root-owned executable binaries and an existing secure chroot base', async () => {
    await expect(validateJailerLaunchContract(buildJailerInvocation(input), operations())).resolves.toBe(true);
  });

  it('reproduces the R.6G missing-chroot-base defect deterministically', async () => {
    await expect(validateJailerLaunchContract(buildJailerInvocation(input), operations({ missingChroot: true })))
      .rejects.toMatchObject({ code: 'guest/worker-command', executionReasonCode: 'judge/jailer-chroot-failed' });
  });

  it('rejects a writable trusted executable', async () => {
    await expect(validateJailerLaunchContract(buildJailerInvocation(input), operations({ writableBinary: true })))
      .rejects.toMatchObject({ executionReasonCode: 'judge/jailer-exec-file-invalid' });
  });

  it.each([
    ['Failed to parse arguments: unknown argument', 'judge/jailer-invalid-arguments'],
    ['Permission denied while creating resource', 'judge/jailer-permission-denied'],
    ['Failed to move process to cgroup', 'judge/jailer-cgroup-failed'],
    ['Failed to chdir into chroot directory', 'judge/jailer-chroot-failed'],
    ['Failed cloning into a new child process namespace', 'judge/jailer-namespace-failed'],
    ['Failed to canonicalize path /safe/firecracker', 'judge/jailer-exec-file-invalid'],
    ['Failed to exec target binary', 'judge/jailer-exec-failed'],
    ['unrecognized bounded material', 'judge/jailer-unknown-startup-failure'],
  ])('maps bounded jailer output to %s', (stderr, expected) => {
    expect(classifyJailerStderr(Buffer.from(stderr))).toBe(expected);
  });

  it('bounds classification input and never retains raw stderr', () => {
    const raw = `private-source:${'x'.repeat(JAILER_STDERR_CLASSIFICATION_BYTES * 2)}`;
    const failure = jailerStartupFailure(1, null, Buffer.from(raw));
    const diagnostic = sanitizedExecutionDiagnostic('safe-execution-1', executionFailure(failure, 'JAILER_INVOKE', failure.executionReasonCode));
    expect(diagnostic).toMatchObject({ stage: 'JAILER_INVOKE', reasonCode: 'judge/jailer-unknown-startup-failure', originalCode: 'guest/worker-command', exitCode: 1 });
    expect(JSON.stringify(failure)).not.toContain('private-source');
    expect(JSON.stringify(diagnostic)).not.toContain('private-source');
  });
});
