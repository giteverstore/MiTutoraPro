import { describe, expect, it, vi } from 'vitest';
import { FirecrackerExecutionController, REQUIRED_CLEANUP_STATE } from '../../functions/src/python-judge/FirecrackerExecutionController.js';
import { firecrackerWorkerManifest } from '../../functions/src/python-judge/FirecrackerWorkerManifest.js';
import { createGuestTestFrame, parseGuestResultFrame } from '../../functions/src/python-judge/GuestProtocol.js';
import { normalizeJudgeRequest } from '../../functions/src/python-judge/JudgeModels.js';
import { FIRECRACKER_SECURITY_PROFILE, PYTHON_EXECUTION_POLICY_VERSION, PYTHON_JUDGE_LIMITS, PYTHON_RUNTIME } from '../../functions/src/python-judge/JudgePolicy.js';
import { PythonJudge, PythonJudgeExecutor } from '../../functions/src/python-judge/PythonJudge.js';
import { createInitialPracticeProtectedTestRegistry, createSyntheticPythonJudgeRegistry } from '../../functions/src/python-judge/PracticeProtectedTestRegistry.js';
import { PracticeVerifier } from '../../functions/src/activity-verification/PracticeVerifier.js';
import { CANONICAL_PYTHON_RUNTIME, canonicalPythonRuntimeImage } from '../../functions/src/python-judge/CanonicalPythonRuntime.js';

const runtimeImage = canonicalPythonRuntimeImage();
const digest = runtimeImage.digest;
const request = Object.freeze({
  activityId: 'synthetic-square', activityVersion: 'v1', contentHash: 'a'.repeat(64), language: 'python', runtimeVersion: '3.14.0',
  sourceCode: 'def square(value): return value * value', protectedSuiteId: 'synthetic-square-suite', protectedSuiteVersion: 'v1',
  runtimeImageDigest: digest, executionPolicyVersion: PYTHON_EXECUTION_POLICY_VERSION, executionId: 'py-test-1',
});

function worker({ frames = [{ status: 'OK', value: 0 }, { status: 'OK', value: 49 }, { status: 'OK', value: 144 }], cleanup = REQUIRED_CLEANUP_STATE, bootError } = {}) {
  let index = 0;
  return {
    prepare: vi.fn().mockResolvedValue({ id: 'handle', executionId: request.executionId }),
    boot: bootError ? vi.fn().mockRejectedValue(bootError) : vi.fn().mockResolvedValue(),
    executeTest: vi.fn().mockImplementation(async () => {
      const frame = frames[Math.min(index, frames.length - 1)]; index += 1;
      if (frame instanceof Error) throw frame;
      return frame;
    }),
    requestShutdown: vi.fn().mockResolvedValue(),
    isVmmAlive: vi.fn().mockResolvedValue(true),
    killCgroup: vi.fn().mockResolvedValue(),
    waitForVmmExit: vi.fn().mockResolvedValue(),
    cleanupRuns: vi.fn().mockResolvedValue(),
    removeCgroup: vi.fn().mockResolvedValue(),
    verifyCleanup: vi.fn().mockResolvedValue(cleanup),
    removeExecution: vi.fn().mockResolvedValue(),
  };
}

function cleanupRaceWorker(sequence) {
  const host = worker();
  host.isVmmAlive = vi.fn().mockImplementation(async () => sequence.shift() ?? false);
  return host;
}

function harness(options) {
  const { controllerOptions, ...workerOptions } = options ?? {};
  const host = worker(workerOptions);
  const controller = new FirecrackerExecutionController({ worker: host, runtimeImage, cleanupPollAttempts: 1, cleanupPollIntervalMs: 0, ...controllerOptions });
  const judge = new PythonJudge({ registry: createSyntheticPythonJudgeRegistry(), controller });
  return { host, controller, judge };
}

describe('M2.3B.1 Python authoritative judge', () => {
  it('pins the approved runtime and exact initial resource envelope', () => {
    expect(PYTHON_RUNTIME).toMatchObject({ version: '3.14.0', firecrackerVersion: '1.16.1' });
    expect(PYTHON_JUDGE_LIMITS).toMatchObject({ vcpuCount: 1, memoryMiB: 256, scratchBytes: 16 * 1024 * 1024, pidLimit: 64, maxSourceBytes: 64 * 1024, maxOutputBytes: 64 * 1024, perTestWallTimeMs: 3000, totalWallTimeMs: 10000 });
    expect(FIRECRACKER_SECURITY_PROFILE).toMatchObject({ isolated: true, networkAccess: false, mmdsEnabled: false, credentialsAvailable: false, rootfsReadOnly: true, jailer: true, seccomp: true, cgroupVersion: 2 });
    expect(CANONICAL_PYTHON_RUNTIME).toMatchObject({
      runtimeDigest: '333b0f4ea024fff35bad974b89990e46f79a8eb19e8fe780963a6942b44d391a',
      rootfsDigest: '290ebfaa470293ea9f156b83b0257fbf04e533d9d9d49a51c9785b4302aa33ec',
      kernelDigest: 'd0fa6b694b32c9d12c5b1575180c888d9c83ff8955d21fe74debb4fe4832db22',
      harnessDigest: 'a5296f6fefa57123a456e37b131b37b333b05f9623be8b7f23722b1fd6e5e734',
      artifact: { generation: '1788850718748121', sha256: '2e831d37fdb716eb1d09e75878b7209f6eb051510c491041af10acb7ca5d0410' },
    });
  });

  it('rejects a well-formed but noncanonical runtime digest', () => {
    expect(() => new FirecrackerExecutionController({
      worker: worker(),
      runtimeImage: { ...runtimeImage, digest: 'f'.repeat(64) },
    })).toThrow('Pinned runtime image binding is required.');
  });

  it('builds a networkless, MMDS-free, read-only Firecracker manifest with cgroup.kill', () => {
    const value = firecrackerWorkerManifest({ executionId: 'py-test-1', runtimeImage });
    expect(value.networkInterfaces).toEqual([]);
    expect(value.mmds).toBeNull();
    expect(value.environment).toEqual({});
    expect(value.firecrackerConfig.drives[0].is_read_only).toBe(true);
    expect(value.cgroupKill).toMatch(/cgroup\.kill$/);
    expect(value.jailerArguments).toContain('--new-pid-ns');
  });

  it('sends one input without the protected expected value and validates a closed result frame', () => {
    const frame = createGuestTestFrame({ sourceCode: request.sourceCode, entryPoint: 'square', arguments: [12] });
    expect(frame).not.toHaveProperty('expected');
    expect(parseGuestResultFrame(Buffer.from('{"schemaVersion":1,"status":"OK","value":144}'))).toEqual({ schemaVersion: 1, status: 'OK', value: 144 });
  });

  it.each([
    Buffer.alloc(PYTHON_JUDGE_LIMITS.maxOutputBytes + 1),
    Buffer.from('not-json'),
    Buffer.from('{"schemaVersion":1,"status":"OK","value":1,"expected":1}'),
    Buffer.from('{"schemaVersion":1,"status":"UNKNOWN"}'),
  ])('rejects malformed or oversized guest frames', (frame) => expect(() => parseGuestResultFrame(frame)).toThrow());

  it.each(['expectedOutput', 'tests', 'passed', 'reward', 'policyVersion', 'cleanupStatus'])('rejects caller authority field %s', (field) => {
    expect(() => normalizeJudgeRequest({ ...request, [field]: true })).toThrow(expect.objectContaining({ code: 'judge/unexpected-field' }));
  });

  it.each([
    [{ ...request, activityVersion: 'latest' }, 'judge/invalid-request'],
    [{ ...request, contentHash: 'wrong' }, 'judge/invalid-request'],
    [{ ...request, language: 'java' }, 'judge/policy-mismatch'],
    [{ ...request, runtimeVersion: '3.13.0' }, 'judge/policy-mismatch'],
    [{ ...request, executionPolicyVersion: 'client-choice' }, 'judge/policy-mismatch'],
    [{ ...request, sourceCode: '' }, 'judge/source-required'],
    [{ ...request, sourceCode: 'x'.repeat(PYTHON_JUDGE_LIMITS.maxSourceBytes + 1) }, 'judge/source-too-large'],
  ])('fails closed on malformed binding', (candidate, code) => expect(() => normalizeJudgeRequest(candidate)).toThrow(expect.objectContaining({ code })));

  it('accepts a correct synthetic result only after clean teardown', async () => {
    const { judge, host } = harness();
    await expect(judge.judge(request)).resolves.toMatchObject({
      status: 'PASS', testsPassed: 3, testsTotal: 3, cleanupStatus: 'VERIFIED', runtimeVersion: '3.14.0',
      contentHash: request.contentHash, protectedSuiteVersion: 'v1', runtimeImageDigest: digest,
    });
    expect(host.killCgroup).toHaveBeenCalledOnce();
    expect(host.removeExecution).toHaveBeenCalledOnce();
  });

  it('fails closed on a duplicate execution ID without starting another VM', async () => {
    const { judge, host } = harness();
    await judge.judge(request);
    await expect(judge.judge(request)).rejects.toMatchObject({ code: 'judge/duplicate-execution' });
    expect(host.prepare).toHaveBeenCalledOnce();
  });

  it('classifies an incorrect result without revealing expected values', async () => {
    const { judge } = harness({ frames: [{ status: 'OK', value: 999 }] });
    const result = await judge.judge({ ...request, sourceCode: 'def square(value): return 999' });
    expect(result).toMatchObject({ status: 'FAIL', testsPassed: 0, cleanupStatus: 'VERIFIED' });
    expect(result).not.toHaveProperty('expected');
    expect(result).not.toHaveProperty('actual');
    expect(result).not.toHaveProperty('stdout');
    expect(result).not.toHaveProperty('stderr');
  });

  it.each([
    ['guest/syntax-error', 'SYNTAX_ERROR'], ['guest/runtime-error', 'RUNTIME_ERROR'], ['guest/timeout', 'TIMEOUT'],
    ['guest/memory-limit', 'MEMORY_LIMIT'], ['guest/pid-limit', 'PID_LIMIT'], ['guest/output-limit', 'OUTPUT_LIMIT'],
    ['guest/disk-limit', 'DISK_LIMIT'], ['guest/invalid-frame', 'JUDGE_ERROR'],
    ['guest/fd-limit', 'FD_LIMIT'],
  ])('classifies %s and still uses cgroup cleanup', async (code, status) => {
    const error = Object.assign(new Error('private detail'), { code });
    const { judge, host } = harness({ frames: [error] });
    await expect(judge.judge(request)).resolves.toMatchObject({ status, cleanupStatus: 'VERIFIED' });
    expect(host.killCgroup).toHaveBeenCalledOnce();
  });

  it('fails closed if any cleanup invariant is not proven', async () => {
    const { judge } = harness({ cleanup: { ...REQUIRED_CLEANUP_STATE, scratchGone: false } });
    await expect(judge.judge(request)).resolves.toMatchObject({ status: 'CLEANUP_FAILURE', cleanupStatus: 'FAILED' });
  });

  it('kills the execution cgroup even when the VMM already exited', async () => {
    const host = cleanupRaceWorker([false]);
    const controller = new FirecrackerExecutionController({ worker: host, runtimeImage });
    const judge = new PythonJudge({ registry: createSyntheticPythonJudgeRegistry(), controller });
    await expect(judge.judge(request)).resolves.toMatchObject({ status: 'PASS', cleanupStatus: 'VERIFIED' });
    expect(host.killCgroup).toHaveBeenCalledOnce();
  });

  it.each([
    ['process', 'CLEANUP_PROCESS_ALIVE', { ...REQUIRED_CLEANUP_STATE, vmmPidGone: false }],
    ['cgroup', 'CLEANUP_CGROUP_ALIVE', { ...REQUIRED_CLEANUP_STATE, cgroupGone: false }],
    ['mount', 'CLEANUP_MOUNT_PRESENT', { ...REQUIRED_CLEANUP_STATE, mountsGone: false }],
    ['socket', 'CLEANUP_SOCKET_PRESENT', { ...REQUIRED_CLEANUP_STATE, socketsGone: false }],
    ['jail', 'CLEANUP_JAIL_PRESENT', { ...REQUIRED_CLEANUP_STATE, jailGone: false }],
    ['scratch', 'CLEANUP_SCRATCH_PRESENT', { ...REQUIRED_CLEANUP_STATE, scratchGone: false }],
  ])('retains fail-closed behavior for a %s cleanup invariant', async (_name, code, cleanup) => {
    const { judge, host, controller } = harness({ cleanup });
    await expect(judge.judge(request)).resolves.toMatchObject({ status: 'CLEANUP_FAILURE', cleanupStatus: 'FAILED' });
    expect(host.removeExecution).not.toHaveBeenCalled();
    expect(controller.lastCleanupDiagnostic).toEqual({ executionId: request.executionId, stage: 'verify-before-remove', code });
  });

  it('does not release a result when cleanup throws during cgroup teardown', async () => {
    const host = worker();
    host.killCgroup = vi.fn().mockRejectedValue(Object.assign(new Error('cgroup'), { code: 'CLEANUP_CGROUP_ALIVE' }));
    const { judge } = harness();
    const controller = new FirecrackerExecutionController({ worker: host, runtimeImage });
    const guardedJudge = new PythonJudge({ registry: createSyntheticPythonJudgeRegistry(), controller });
    await expect(guardedJudge.judge(request)).resolves.toMatchObject({ status: 'CLEANUP_FAILURE', cleanupStatus: 'FAILED' });
    expect(controller.lastCleanupDiagnostic).toEqual({ executionId: request.executionId, stage: 'UNKNOWN', code: 'CLEANUP_CGROUP_ALIVE', operation: null, exitCode: null, pathClass: null, retry: null });
  });

  it('orders cgroup kill, process wait, invariant verification and execution removal', async () => {
    const { judge, host } = harness();
    await judge.judge(request);
    expect(host.killCgroup.mock.invocationCallOrder[0]).toBeLessThan(host.waitForVmmExit.mock.invocationCallOrder[0]);
    expect(host.waitForVmmExit.mock.invocationCallOrder[0]).toBeLessThan(host.cleanupRuns.mock.invocationCallOrder[0]);
    expect(host.cleanupRuns.mock.invocationCallOrder[0]).toBeLessThan(host.removeCgroup.mock.invocationCallOrder[0]);
    expect(host.removeCgroup.mock.invocationCallOrder[0]).toBeLessThan(host.verifyCleanup.mock.invocationCallOrder[0]);
    expect(host.verifyCleanup.mock.invocationCallOrder[0]).toBeLessThan(host.removeExecution.mock.invocationCallOrder[0]);
    expect(host.removeExecution.mock.invocationCallOrder[0]).toBeLessThan(host.verifyCleanup.mock.invocationCallOrder[1]);
  });

  it('waits through a transient socket after process death before releasing the result', async () => {
    const { judge, host } = harness({ controllerOptions: { cleanupPollAttempts: 3 }, cleanup: REQUIRED_CLEANUP_STATE });
    host.verifyCleanup.mockReset()
      .mockResolvedValueOnce({ ...REQUIRED_CLEANUP_STATE, socketsGone: false })
      .mockResolvedValue(REQUIRED_CLEANUP_STATE);
    await expect(judge.judge(request)).resolves.toMatchObject({ status: 'PASS', cleanupStatus: 'VERIFIED' });
    expect(host.verifyCleanup).toHaveBeenCalledTimes(3);
  });

  it('waits through delayed mount teardown before releasing the result', async () => {
    const { judge, host } = harness({ controllerOptions: { cleanupPollAttempts: 3 }, cleanup: REQUIRED_CLEANUP_STATE });
    host.verifyCleanup.mockReset()
      .mockResolvedValueOnce({ ...REQUIRED_CLEANUP_STATE, mountsGone: false })
      .mockResolvedValue(REQUIRED_CLEANUP_STATE);
    await expect(judge.judge(request)).resolves.toMatchObject({ status: 'PASS', cleanupStatus: 'VERIFIED' });
  });

  it('waits through transient jail artifacts before releasing the result', async () => {
    const { judge, host } = harness({ controllerOptions: { cleanupPollAttempts: 3 }, cleanup: REQUIRED_CLEANUP_STATE });
    host.verifyCleanup.mockReset()
      .mockResolvedValueOnce({ ...REQUIRED_CLEANUP_STATE, jailGone: false })
      .mockResolvedValue(REQUIRED_CLEANUP_STATE);
    await expect(judge.judge(request)).resolves.toMatchObject({ status: 'PASS', cleanupStatus: 'VERIFIED' });
  });

  it('preserves timeout classification only after teardown is verified', async () => {
    const timeout = Object.assign(new Error('private'), { code: 'guest/timeout' });
    const { judge, host } = harness({ frames: [timeout] });
    await expect(judge.judge(request)).resolves.toMatchObject({ status: 'TIMEOUT', cleanupStatus: 'VERIFIED' });
    expect(host.killCgroup).toHaveBeenCalledOnce();
  });

  it('replaces a timeout outcome with CLEANUP_FAILURE when process-tree cleanup is uncertain', async () => {
    const timeout = Object.assign(new Error('private'), { code: 'guest/timeout' });
    const { judge } = harness({ frames: [timeout], cleanup: { ...REQUIRED_CLEANUP_STATE, guestProcessesGone: false } });
    await expect(judge.judge(request)).resolves.toMatchObject({ status: 'CLEANUP_FAILURE', cleanupStatus: 'FAILED' });
  });

  it.each([
    ['Firecracker exits before jailer', false],
    ['jailer exits before Firecracker', true],
    ['guest process tree survives initial termination', true],
  ])('requires cgroup kill when %s', async (_scenario, alive) => {
    const host = cleanupRaceWorker([alive]);
    const controller = new FirecrackerExecutionController({ worker: host, runtimeImage });
    const judge = new PythonJudge({ registry: createSyntheticPythonJudgeRegistry(), controller });
    await expect(judge.judge(request)).resolves.toMatchObject({ cleanupStatus: 'VERIFIED' });
    expect(host.killCgroup).toHaveBeenCalledOnce();
    expect(host.waitForVmmExit).toHaveBeenCalledOnce();
  });

  it('uses cgroup.kill after boot failure and never starts a test', async () => {
    const { judge, host } = harness({ bootError: Object.assign(new Error('boot'), { code: 'guest/boot' }) });
    await expect(judge.judge(request)).resolves.toMatchObject({ status: 'JUDGE_ERROR', cleanupStatus: 'VERIFIED' });
    expect(host.executeTest).not.toHaveBeenCalled();
    expect(host.killCgroup).toHaveBeenCalledOnce();
  });

  it('records a bounded prepare-stage diagnostic when no cleanup handle exists', async () => {
    const host = worker();
    host.prepare = vi.fn().mockRejectedValue(Object.assign(new Error('private path detail'), { code: 'guest/worker-command' }));
    const controller = new FirecrackerExecutionController({ worker: host, runtimeImage });
    const judge = new PythonJudge({ registry: createSyntheticPythonJudgeRegistry(), controller });
    await expect(judge.judge(request)).resolves.toMatchObject({ status: 'CLEANUP_FAILURE', cleanupStatus: 'FAILED' });
    expect(controller.lastCleanupDiagnostic).toEqual({ executionId: request.executionId, stage: 'prepare', code: 'CLEANUP_UNKNOWN' });
    expect(JSON.stringify(controller.lastCleanupDiagnostic)).not.toContain('private path detail');
  });

  it('binds initial Practice suites to canonical IDs, versions and hashes', () => {
    const registry = createInitialPracticeProtectedTestRegistry();
    expect(registry.resolve({ activityId: 'fund-variables-001', activityVersion: 'v2', contentHash: 'f82864abec10ea3c150af37372e32011ca53fb87868b0d57114230821bc48524', language: 'python', protectedSuiteId: 'practice-fund-variables-001', protectedSuiteVersion: 'v1' }).tests).toHaveLength(2);
    expect(() => registry.resolve({ ...request, activityId: 'fund-variables-001' })).toThrow(expect.objectContaining({ code: 'judge/protected-suite-mismatch' }));
  });

  it('adapts trusted PASS through PracticeVerifier without accepting browser status', async () => {
    const { judge } = harness();
    const executor = new PythonJudgeExecutor({ judge, resolveBinding: async () => ({ ...request, sourceCode: undefined }) });
    const verifier = new PracticeVerifier({ executor });
    await expect(verifier.verify({
      request: { activityType: 'PRACTICE', sourceCode: request.sourceCode },
      activity: { language: 'python', verification: { tests: [{}, {}, {}] } },
      limits: { executionTimeoutMs: 10_000 },
    })).resolves.toEqual({ passed: true, testCount: 3 });
  });

  it('does not serialize source, protected arguments, expected values, stdout or stderr in trusted results', async () => {
    const result = await harness().judge.judge(request);
    const text = JSON.stringify(result);
    for (const forbidden of ['sourceCode', 'arguments', 'expected', 'stdout', 'stderr', request.sourceCode]) expect(text).not.toContain(forbidden);
  });
});
