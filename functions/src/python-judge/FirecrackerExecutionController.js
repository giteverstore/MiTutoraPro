import { performance } from 'node:perf_hooks';
import { isDeepStrictEqual } from 'node:util';
import { PYTHON_JUDGE_LIMITS, PYTHON_RUNTIME } from './JudgePolicy.js';
import { CANONICAL_PYTHON_RUNTIME } from './CanonicalPythonRuntime.js';
import { sanitizedCleanupDiagnostic } from './CleanupCoordinator.js';
import { executionFailure, sanitizedExecutionDiagnostic } from './ExecutionDiagnostics.js';

const CLEAN = Object.freeze({
  vmmPidGone: true, guestProcessesGone: true, cgroupGone: true, mountsGone: true,
  socketsGone: true, jailGone: true, scratchGone: true,
});

function cleanupComplete(value) { return Object.keys(CLEAN).every((field) => value?.[field] === true); }

function cleanupCode(value) {
  if (value?.vmmPidGone !== true || value?.guestProcessesGone !== true) return 'CLEANUP_PROCESS_ALIVE';
  if (value?.cgroupGone !== true) return 'CLEANUP_CGROUP_ALIVE';
  if (value?.mountsGone !== true) return 'CLEANUP_MOUNT_PRESENT';
  if (value?.socketsGone !== true) return 'CLEANUP_SOCKET_PRESENT';
  if (value?.jailGone !== true) return 'CLEANUP_JAIL_PRESENT';
  if (value?.scratchGone !== true) return 'CLEANUP_SCRATCH_PRESENT';
  return 'CLEANUP_UNKNOWN';
}

function classification(error) {
  const code = error?.code;
  if (code === 'guest/timeout') return 'TIMEOUT';
  if (code === 'guest/memory-limit') return 'MEMORY_LIMIT';
  if (code === 'guest/pid-limit') return 'PID_LIMIT';
  if (code === 'guest/output-limit') return 'OUTPUT_LIMIT';
  if (code === 'guest/disk-limit') return 'DISK_LIMIT';
  if (code === 'guest/fd-limit') return 'FD_LIMIT';
  if (code === 'guest/syntax-error') return 'SYNTAX_ERROR';
  if (code === 'guest/runtime-error') return 'RUNTIME_ERROR';
  return 'JUDGE_ERROR';
}

async function bounded(promise, timeoutMs, signal, getSnapshot, fallbackStage, fallbackReasonCode, executionId) {
  const createTimeout = () => {
    const candidate = getSnapshot?.();
    const snapshot = candidate?.executionId === executionId ? candidate : null;
    return timeoutFailure(snapshot, fallbackStage, fallbackReasonCode);
  };
  if (signal?.aborted) throw createTimeout();
  let timer;
  let abort;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(createTimeout()), timeoutMs); }),
      new Promise((_, reject) => {
        abort = () => reject(createTimeout());
        signal?.addEventListener('abort', abort, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (abort) signal?.removeEventListener('abort', abort);
  }
}

function timeoutFailure(snapshot, fallbackStage, fallbackReasonCode) {
  return executionFailure(
    Object.assign(new Error('Execution timed out.'), { code: 'guest/timeout' }),
    snapshot?.stage ?? fallbackStage,
    snapshot?.reasonCode ?? fallbackReasonCode,
    snapshot?.evidence,
  );
}

export class FirecrackerExecutionController {
  constructor({ worker, runtimeImage, cleanupPollAttempts = 100, cleanupPollIntervalMs = 20 }) {
    if (!worker || !['prepare', 'boot', 'executeTest', 'requestShutdown', 'isVmmAlive', 'killCgroup', 'waitForVmmExit', 'cleanupRuns', 'removeCgroup', 'verifyCleanup', 'removeExecution'].every((method) => typeof worker[method] === 'function')) {
      throw new TypeError('A complete Firecracker worker adapter is required.');
    }
    if (runtimeImage?.digest !== CANONICAL_PYTHON_RUNTIME.runtimeDigest
      || runtimeImage?.rootfsDigest !== CANONICAL_PYTHON_RUNTIME.rootfsDigest
      || runtimeImage?.kernelDigest !== CANONICAL_PYTHON_RUNTIME.kernelDigest
      || runtimeImage.pythonVersion !== PYTHON_RUNTIME.version
      || runtimeImage.guestKernelVersion !== PYTHON_RUNTIME.guestKernelVersion
      || runtimeImage.firecrackerVersion !== PYTHON_RUNTIME.firecrackerVersion) throw new TypeError('Pinned runtime image binding is required.');
    if (!Number.isSafeInteger(cleanupPollAttempts) || cleanupPollAttempts < 1 || cleanupPollAttempts > 500
      || !Number.isSafeInteger(cleanupPollIntervalMs) || cleanupPollIntervalMs < 0 || cleanupPollIntervalMs > 1_000) {
      throw new TypeError('A bounded cleanup polling policy is required.');
    }
    this.worker = worker;
    this.runtimeImage = Object.freeze({ ...runtimeImage });
    this.cleanupPollAttempts = cleanupPollAttempts;
    this.cleanupPollIntervalMs = cleanupPollIntervalMs;
    this.lastCleanupDiagnostic = null;
    this.lastExecutionDiagnostic = null;
  }

  async #waitForCleanup(handle) {
    let cleanup;
    for (let attempt = 0; attempt < this.cleanupPollAttempts; attempt += 1) {
      cleanup = await this.worker.verifyCleanup(handle);
      if (cleanupComplete(cleanup)) return cleanup;
      if (attempt + 1 < this.cleanupPollAttempts && this.cleanupPollIntervalMs > 0) {
        await new Promise((done) => setTimeout(done, this.cleanupPollIntervalMs));
      }
    }
    return cleanup;
  }

  async #destroy(handle) {
    let cleanup;
    this.lastCleanupDiagnostic = null;
    try {
      // The execution cgroup is a mandatory cleanup target even after the VMM
      // exits. Checking only process liveness can skip cgroup.kill while the
      // cgroup still exists and makes the subsequent rmdir race-prone.
      await this.worker.killCgroup(handle);
      await this.worker.waitForVmmExit(handle);
      await this.worker.cleanupRuns(handle);
      await this.worker.removeCgroup(handle);
      cleanup = await this.#waitForCleanup(handle);
      if (!cleanupComplete(cleanup)) {
        this.lastCleanupDiagnostic = Object.freeze({ executionId: handle.executionId, stage: 'verify-before-remove', code: cleanupCode(cleanup) });
        return false;
      }
      await this.worker.removeExecution(handle);
      cleanup = await this.#waitForCleanup(handle);
      if (!cleanupComplete(cleanup)) {
        this.lastCleanupDiagnostic = Object.freeze({ executionId: handle.executionId, stage: 'verify-after-remove', code: cleanupCode(cleanup) });
        return false;
      }
      return true;
    } catch (error) {
      this.lastCleanupDiagnostic = sanitizedCleanupDiagnostic(handle.executionId, error);
      return false;
    }
  }

  async execute({ request, suite, signal }) {
    const started = performance.now();
    const deadline = started + PYTHON_JUDGE_LIMITS.totalWallTimeMs;
    let handle;
    let executionError;
    let status = 'JUDGE_ERROR';
    let reasonCode = 'judge/infrastructure';
    let testsPassed = 0;
    this.lastExecutionDiagnostic = null;
    try {
      handle = await this.worker.prepare({
        executionId: request.executionId,
        runtimeImage: this.runtimeImage,
        limits: PYTHON_JUDGE_LIMITS,
        networkInterfaces: 0,
        mmds: false,
        credentials: null,
        rootfsReadOnly: true,
      });
      await bounded(
        this.worker.boot(handle, { signal }),
        Math.max(1, deadline - performance.now()),
        signal,
        () => this.worker.getExecutionDiagnosticSnapshot?.(handle, request.executionId),
        'RUNTIME_VALIDATE',
        'judge/runtime-integrity-failed',
        request.executionId,
      );
      for (const test of suite.tests) {
        const remaining = Math.max(1, deadline - performance.now());
        const frame = await bounded(this.worker.executeTest(handle, {
          sourceCode: request.sourceCode,
          entryPoint: suite.entryPoint,
          arguments: test.arguments,
          timeoutMs: PYTHON_JUDGE_LIMITS.perTestWallTimeMs,
          maxOutputBytes: PYTHON_JUDGE_LIMITS.maxOutputBytes,
          signal,
        }), Math.min(PYTHON_JUDGE_LIMITS.perTestWallTimeMs, remaining), signal,
        () => this.worker.getExecutionDiagnosticSnapshot?.(handle, request.executionId),
        'SCRATCH_PREPARE',
        'judge/scratch-prepare-failed',
        request.executionId);
        if (!frame) throw executionFailure(Object.assign(new Error('Guest result is absent.'), { code: 'guest/invalid-frame' }), 'RESULT_VALIDATE', 'judge/guest-result-invalid');
        if (frame.status !== 'OK') throw Object.assign(new Error('Guest execution failed.'), { code: frame.code ?? 'guest/invalid-frame' });
        if (!isDeepStrictEqual(frame.value, test.expected)) {
          status = 'FAIL'; reasonCode = 'judge/wrong-answer'; break;
        }
        testsPassed += 1;
      }
      if (testsPassed === suite.tests.length) { status = 'PASS'; reasonCode = 'judge/pass'; }
      await this.worker.requestShutdown(handle);
    } catch (error) {
      executionError = error;
      this.lastExecutionDiagnostic = sanitizedExecutionDiagnostic(request.executionId, error);
      status = classification(error);
      reasonCode = `judge/${status.toLowerCase().replaceAll('_', '-')}`;
    }
    const clean = handle ? await this.#destroy(handle) : false;
    if (!handle) {
      this.lastCleanupDiagnostic = Object.freeze({
        executionId: request.executionId,
        stage: 'prepare',
        code: executionError?.code?.startsWith?.('CLEANUP_') ? executionError.code : 'CLEANUP_UNKNOWN',
      });
    }
    if (!clean) { status = 'CLEANUP_FAILURE'; reasonCode = 'judge/cleanup-failure'; }
    return Object.freeze({ status, reasonCode, testsPassed, testsTotal: suite.tests.length, cleanupStatus: clean ? 'VERIFIED' : 'FAILED', durationMs: performance.now() - started });
  }
}

export { CLEAN as REQUIRED_CLEANUP_STATE };
