import { describe, expect, it, vi } from 'vitest';
import { executionFailure, liveExecutionDiagnosticSnapshot, setLiveExecutionStage } from '../../functions/src/python-judge/ExecutionDiagnostics.js';
import { FirecrackerExecutionController, REQUIRED_CLEANUP_STATE } from '../../functions/src/python-judge/FirecrackerExecutionController.js';
import { canonicalPythonRuntimeImage } from '../../functions/src/python-judge/CanonicalPythonRuntime.js';

const request = Object.freeze({ executionId: 'diagnostic-test' });
const suite = Object.freeze({ entryPoint: 'ping', tests: Object.freeze([{ arguments: Object.freeze([]), expected: 'OK' }]) });

function worker(executionError, { cleanupError } = {}) {
  return {
    prepare: vi.fn().mockResolvedValue({ executionId: request.executionId }),
    boot: vi.fn().mockResolvedValue(),
    executeTest: vi.fn().mockRejectedValue(executionError),
    requestShutdown: vi.fn().mockResolvedValue(),
    isVmmAlive: vi.fn().mockResolvedValue(false),
    killCgroup: vi.fn().mockResolvedValue(),
    waitForVmmExit: vi.fn().mockResolvedValue(),
    cleanupRuns: cleanupError ? vi.fn().mockRejectedValue(cleanupError) : vi.fn().mockResolvedValue(),
    removeCgroup: vi.fn().mockResolvedValue(),
    verifyCleanup: vi.fn().mockResolvedValue(REQUIRED_CLEANUP_STATE),
    removeExecution: vi.fn().mockResolvedValue(),
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function liveTimeoutWorker({ stage, reasonCode, evidence = {}, executionId = request.executionId, cleanupError, late }) {
  const host = worker(Object.assign(new Error('unused'), { code: 'guest/worker-command' }), { cleanupError });
  host.executeTest = vi.fn().mockImplementation(() => {
    queueMicrotask(() => late.signal.abort());
    return late.promise;
  });
  host.getExecutionDiagnosticSnapshot = vi.fn().mockReturnValue(Object.freeze({
    executionId,
    stage,
    reasonCode,
    evidence: Object.freeze({
      jailerInvoked: evidence.jailerInvoked === true,
      socketReady: evidence.socketReady === true,
      pidAcquired: evidence.pidAcquired === true,
      vmStarted: evidence.vmStarted === true,
      responseRead: evidence.responseRead === true,
    }),
  }));
  return host;
}

async function controllerTimeout(options) {
  const signal = new AbortController();
  const late = { ...deferred(), signal };
  const host = liveTimeoutWorker({ ...options, late });
  const controller = new FirecrackerExecutionController({ worker: host, runtimeImage: canonicalPythonRuntimeImage(), cleanupPollAttempts: 1, cleanupPollIntervalMs: 0 });
  const result = await controller.execute({ request, suite, signal: signal.signal });
  return { controller, host, late, result };
}

const cases = [
  ['Firecracker spawn failure', 'JAILER_INVOKE', 'judge/firecracker-spawn-failed'],
  ['Firecracker exit before socket readiness', 'FIRECRACKER_SOCKET_WAIT', 'judge/firecracker-exit-before-ready'],
  ['socket readiness timeout', 'FIRECRACKER_SOCKET_WAIT', 'judge/firecracker-socket-timeout'],
  ['machine configuration failure', 'VM_CONFIG_MACHINE', 'judge/vm-config-failed'],
  ['VM start failure', 'VM_START', 'judge/vm-start-failed'],
  ['guest readiness timeout', 'GUEST_EXECUTION_WAIT', 'judge/guest-protocol-timeout'],
  ['guest protocol timeout', 'GUEST_EXECUTION_WAIT', 'judge/guest-protocol-timeout'],
  ['malformed guest response', 'GUEST_RESPONSE_PARSE', 'judge/guest-response-invalid'],
  ['invalid result schema', 'RESULT_VALIDATE', 'judge/guest-result-invalid'],
];

describe('sanitized judge execution-stage diagnostics', () => {
  it('returns an immutable execution-bound live snapshot', () => {
    const context = {
      executionId: request.executionId,
      executionDiagnosticStage: null,
      executionEvidence: { jailerInvoked: true, socketReady: false },
    };
    setLiveExecutionStage(context, request.executionId, 'FIRECRACKER_SOCKET_WAIT', 'judge/firecracker-socket-timeout');
    const snapshot = liveExecutionDiagnosticSnapshot(context, request.executionId);
    context.executionEvidence.socketReady = true;
    expect(snapshot).toEqual({
      executionId: request.executionId,
      stage: 'FIRECRACKER_SOCKET_WAIT',
      reasonCode: 'judge/firecracker-socket-timeout',
      evidence: { jailerInvoked: true, socketReady: false, pidAcquired: false, vmStarted: false, responseRead: false },
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.evidence)).toBe(true);
    expect(liveExecutionDiagnosticSnapshot(context, 'another-execution')).toBeNull();
  });

  it.each(cases)('preserves %s without releasing raw error data', async (_label, stage, reasonCode) => {
    const raw = Object.assign(new Error('private source and command output'), { code: 'guest/worker-command', exitCode: 17, signal: 'SIGTERM' });
    const host = worker(executionFailure(raw, stage, reasonCode, { jailerInvoked: true }));
    const controller = new FirecrackerExecutionController({ worker: host, runtimeImage: canonicalPythonRuntimeImage(), cleanupPollAttempts: 1, cleanupPollIntervalMs: 0 });
    const result = await controller.execute({ request, suite });
    expect(result).toMatchObject({ status: 'JUDGE_ERROR', reasonCode: 'judge/judge-error', cleanupStatus: 'VERIFIED' });
    expect(controller.lastExecutionDiagnostic).toMatchObject({ stage, reasonCode, exitCode: 17, signal: 'SIGTERM' });
    expect(JSON.stringify(controller.lastExecutionDiagnostic)).not.toContain('private source');
    expect(host.killCgroup).toHaveBeenCalledOnce();
    expect(host.cleanupRuns).toHaveBeenCalledOnce();
  });

  it('keeps cleanup failure independently authoritative after an execution-stage failure', async () => {
    const executionError = executionFailure(Object.assign(new Error('raw'), { code: 'guest/worker-command' }), 'VM_START', 'judge/vm-start-failed');
    const cleanupError = Object.assign(new Error('busy'), { code: 'UNMOUNT_BUSY', cleanupStage: 'MOUNTS_REMOVED', cleanupOperation: 'unmount', cleanupPathClass: 'run-mount', cleanupRetry: 3 });
    const host = worker(executionError, { cleanupError });
    const controller = new FirecrackerExecutionController({ worker: host, runtimeImage: canonicalPythonRuntimeImage(), cleanupPollAttempts: 1, cleanupPollIntervalMs: 0 });
    const result = await controller.execute({ request, suite });
    expect(result).toMatchObject({ status: 'CLEANUP_FAILURE', reasonCode: 'judge/cleanup-failure', cleanupStatus: 'FAILED' });
    expect(controller.lastExecutionDiagnostic).toMatchObject({ stage: 'VM_START', reasonCode: 'judge/vm-start-failed' });
    expect(controller.lastCleanupDiagnostic).toMatchObject({ code: 'UNMOUNT_BUSY', stage: 'MOUNTS_REMOVED' });
  });

  it.each([
    ['SCRATCH_PREPARE', 'judge/scratch-prepare-failed'],
    ['JAILER_INVOKE', 'judge/firecracker-spawn-failed'],
    ['FIRECRACKER_SOCKET_WAIT', 'judge/firecracker-socket-timeout'],
    ['VM_CONFIG_MACHINE', 'judge/vm-config-failed'],
    ['VM_START', 'judge/vm-start-failed'],
    ['GUEST_EXECUTION_WAIT', 'judge/guest-protocol-timeout'],
  ])('preserves live %s when the controller deadline wins', async (stage, reasonCode) => {
    const { controller, result } = await controllerTimeout({ stage, reasonCode });
    expect(result).toMatchObject({ status: 'TIMEOUT', reasonCode: 'judge/timeout', cleanupStatus: 'VERIFIED' });
    expect(controller.lastExecutionDiagnostic).toMatchObject({ stage, reasonCode, originalCode: 'guest/timeout', timedOut: true });
    expect(controller.lastExecutionDiagnostic.stage).not.toBe('RESULT_VALIDATE');
  });

  it('preserves the live milestone snapshot on timeout', async () => {
    const evidence = { jailerInvoked: true, socketReady: true, pidAcquired: true, vmStarted: true, responseRead: false };
    const { controller } = await controllerTimeout({ stage: 'GUEST_EXECUTION_WAIT', reasonCode: 'judge/guest-protocol-timeout', evidence });
    expect(controller.lastExecutionDiagnostic.evidence).toEqual(evidence);
    expect(Object.isFrozen(controller.lastExecutionDiagnostic.evidence)).toBe(true);
  });

  it('uses a narrow pre-worker fallback and rejects a cross-execution snapshot', async () => {
    const { controller } = await controllerTimeout({
      stage: 'VM_START', reasonCode: 'judge/vm-start-failed', executionId: 'different-execution',
    });
    expect(controller.lastExecutionDiagnostic).toMatchObject({
      executionId: request.executionId,
      stage: 'SCRATCH_PREPARE',
      reasonCode: 'judge/scratch-prepare-failed',
      originalCode: 'guest/timeout',
      timedOut: true,
    });
  });

  it('uses runtime validation as the narrow fallback when timeout precedes boot initialization', async () => {
    const signal = new AbortController();
    signal.abort();
    const host = worker(new Error('unused'));
    host.boot = vi.fn().mockReturnValue(new Promise(() => {}));
    host.getExecutionDiagnosticSnapshot = vi.fn().mockReturnValue(null);
    const controller = new FirecrackerExecutionController({ worker: host, runtimeImage: canonicalPythonRuntimeImage(), cleanupPollAttempts: 1, cleanupPollIntervalMs: 0 });
    const result = await controller.execute({ request, suite, signal: signal.signal });
    expect(result.status).toBe('TIMEOUT');
    expect(controller.lastExecutionDiagnostic).toMatchObject({ stage: 'RUNTIME_VALIDATE', originalCode: 'guest/timeout', timedOut: true });
    expect(host.executeTest).not.toHaveBeenCalled();
  });

  it('accepts worker success that settles before the timeout', async () => {
    const host = worker(new Error('unused'));
    host.executeTest = vi.fn().mockResolvedValue({ status: 'OK', value: 'OK' });
    const controller = new FirecrackerExecutionController({ worker: host, runtimeImage: canonicalPythonRuntimeImage(), cleanupPollAttempts: 1, cleanupPollIntervalMs: 0 });
    await expect(controller.execute({ request, suite })).resolves.toMatchObject({ status: 'PASS', cleanupStatus: 'VERIFIED' });
    expect(controller.lastExecutionDiagnostic).toBeNull();
  });

  it('preserves a worker failure that settles before the timeout', async () => {
    const failure = executionFailure(new Error('safe test failure'), 'VM_START', 'judge/vm-start-failed');
    const host = worker(failure);
    const controller = new FirecrackerExecutionController({ worker: host, runtimeImage: canonicalPythonRuntimeImage(), cleanupPollAttempts: 1, cleanupPollIntervalMs: 0 });
    await expect(controller.execute({ request, suite })).resolves.toMatchObject({ status: 'JUDGE_ERROR', cleanupStatus: 'VERIFIED' });
    expect(controller.lastExecutionDiagnostic).toMatchObject({ stage: 'VM_START', reasonCode: 'judge/vm-start-failed', timedOut: false });
  });

  it('does not let late worker success overwrite a finalized timeout', async () => {
    const state = await controllerTimeout({ stage: 'VM_START', reasonCode: 'judge/vm-start-failed' });
    const diagnostic = state.controller.lastExecutionDiagnostic;
    state.late.resolve({ status: 'OK', value: 'OK' });
    await Promise.resolve();
    expect(state.result.status).toBe('TIMEOUT');
    expect(state.controller.lastExecutionDiagnostic).toBe(diagnostic);
    expect(state.host.cleanupRuns).toHaveBeenCalledOnce();
  });

  it('does not let late worker failure corrupt a finalized timeout', async () => {
    const state = await controllerTimeout({ stage: 'FIRECRACKER_SOCKET_WAIT', reasonCode: 'judge/firecracker-socket-timeout' });
    const diagnostic = state.controller.lastExecutionDiagnostic;
    state.late.reject(executionFailure(new Error('late private failure'), 'RESULT_VALIDATE', 'judge/guest-result-invalid'));
    await Promise.resolve();
    expect(state.result.status).toBe('TIMEOUT');
    expect(state.controller.lastExecutionDiagnostic).toBe(diagnostic);
    expect(JSON.stringify(diagnostic)).not.toContain('late private failure');
  });

  it('keeps cleanup failure independently authoritative after a live-stage timeout', async () => {
    const cleanupError = Object.assign(new Error('busy'), { code: 'UNMOUNT_BUSY', cleanupStage: 'MOUNTS_REMOVED', cleanupOperation: 'unmount' });
    const { controller, host, result } = await controllerTimeout({ stage: 'VM_START', reasonCode: 'judge/vm-start-failed', cleanupError });
    expect(result).toMatchObject({ status: 'CLEANUP_FAILURE', reasonCode: 'judge/cleanup-failure', cleanupStatus: 'FAILED' });
    expect(controller.lastExecutionDiagnostic).toMatchObject({ stage: 'VM_START', originalCode: 'guest/timeout', timedOut: true });
    expect(host.killCgroup).toHaveBeenCalledOnce();
    expect(host.cleanupRuns).toHaveBeenCalledOnce();
  });
});
