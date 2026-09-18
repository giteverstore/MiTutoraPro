import { readFile, writeFile } from 'node:fs/promises';
import { FirecrackerExecutionController } from '../../functions/src/python-judge/FirecrackerExecutionController.js';
import { PYTHON_EXECUTION_POLICY_VERSION, PYTHON_RUNTIME } from '../../functions/src/python-judge/JudgePolicy.js';
import { LinuxFirecrackerWorker } from '../../functions/src/python-judge/LinuxFirecrackerWorker.js';
import { ProtectedTestRegistry } from '../../functions/src/python-judge/ProtectedTestRegistry.js';
import { createInitialPracticeProtectedTestRegistry, createSyntheticPythonJudgeRegistry } from '../../functions/src/python-judge/PracticeProtectedTestRegistry.js';
import { PythonJudge, PythonJudgeExecutor } from '../../functions/src/python-judge/PythonJudge.js';
import { PracticeVerifier } from '../../functions/src/activity-verification/PracticeVerifier.js';
import { CANONICAL_PYTHON_RUNTIME, canonicalPythonRuntimeImage } from '../../functions/src/python-judge/CanonicalPythonRuntime.js';

const manifest = JSON.parse(await readFile('/opt/mitutora-judge/runtime/manifest.json', 'utf8'));
for (const [field, expected] of Object.entries({
  runtimeDigest: CANONICAL_PYTHON_RUNTIME.runtimeDigest,
  rootfsDigest: CANONICAL_PYTHON_RUNTIME.rootfsDigest,
  kernelDigest: CANONICAL_PYTHON_RUNTIME.kernelDigest,
  harnessDigest: CANONICAL_PYTHON_RUNTIME.harnessDigest,
  pythonVersion: CANONICAL_PYTHON_RUNTIME.pythonVersion,
  guestKernelVersion: CANONICAL_PYTHON_RUNTIME.guestKernelVersion,
  firecrackerVersion: CANONICAL_PYTHON_RUNTIME.firecrackerVersion,
})) {
  if (manifest[field] !== expected) throw new Error(`Canonical runtime manifest mismatch: ${field}.`);
}
const runtimeImage = canonicalPythonRuntimeImage();
const worker = new LinuxFirecrackerWorker();

function request(activityId, suiteId, contentHash, executionId, sourceCode, activityVersion = 'v1') {
  return Object.freeze({
    activityId, activityVersion, contentHash, language: 'python', runtimeVersion: PYTHON_RUNTIME.version,
    sourceCode, protectedSuiteId: suiteId, protectedSuiteVersion: 'v1', runtimeImageDigest: runtimeImage.digest,
    executionPolicyVersion: PYTHON_EXECUTION_POLICY_VERSION, executionId,
  });
}

function registry(activityId, suiteId, expected = 0) {
  return new ProtectedTestRegistry().register({
    suiteId, suiteVersion: 'v1', activityId, activityVersion: 'v1', contentHash: 'e'.repeat(64),
    language: 'python', entryPoint: 'square', tests: [{ arguments: [2], expected }],
  });
}

const cases = [
  ['correct', 'PASS', 'def square(value):\n    return value * value', createSyntheticPythonJudgeRegistry(), 'synthetic-square-suite', 'a'.repeat(64)],
  ['incorrect', 'FAIL', 'def square(value):\n    return value + value', createSyntheticPythonJudgeRegistry(), 'synthetic-square-suite', 'a'.repeat(64)],
  ['syntax-error', 'SYNTAX_ERROR', 'def square(value)\n    return value', null],
  ['runtime-error', 'RUNTIME_ERROR', 'def square(value):\n    raise RuntimeError("synthetic")', null],
  ['infinite-loop', 'TIMEOUT', 'def square(value):\n    while True: pass', null],
  ['memory-pressure', 'MEMORY_LIMIT', 'def square(value):\n    held=[]\n    while True: held.append(bytearray(8388608))', null],
  ['pid-pressure', 'PID_LIMIT', 'def square(value):\n    import os, time\n    while True:\n        pid=os.fork()\n        if pid == 0:\n            time.sleep(60)\n            os._exit(0)', null],
  ['output-flood', 'OUTPUT_LIMIT', 'def square(value):\n    while True: print("X" * 4096)', null],
  ['disk-fill', 'DISK_LIMIT', 'def square(value):\n    with open("/work/fill", "wb") as target:\n        while True: target.write(b"X" * 1048576)', null],
  ['process-tree', 'TIMEOUT', 'def square(value):\n    import os\n    if os.fork() == 0:\n        while True: pass\n    while True: pass', null],
  ['fd-pressure', 'FD_LIMIT', 'def square(value):\n    held=[]\n    while True: held.append(open("/dev/null", "rb"))', null],
];

const ledger = [];
for (let index = 0; index < cases.length; index += 1) {
  const [caseId, expectedStatus, sourceCode, suppliedRegistry, suppliedSuiteId, suppliedHash] = cases[index];
  const activityId = suppliedRegistry ? 'synthetic-square' : `synthetic-${caseId}`;
  const suiteId = suppliedSuiteId ?? `${activityId}-suite`;
  const contentHash = suppliedHash ?? 'e'.repeat(64);
  const selectedRegistry = suppliedRegistry ?? registry(activityId, suiteId);
  const controller = new FirecrackerExecutionController({ worker, runtimeImage });
  const judge = new PythonJudge({ registry: selectedRegistry, controller });
  const started = Date.now();
  const result = await judge.judge(request(activityId, suiteId, contentHash, `py-real-${index + 1}`, sourceCode));
  ledger.push(Object.freeze({ caseId, expectedStatus, status: result.status, reasonCode: result.reasonCode, cleanupStatus: result.cleanupStatus, durationClass: Date.now() - started < 5_000 ? 'under-5s' : '5s-or-more', passed: result.status === expectedStatus && result.cleanupStatus === 'VERIFIED' }));
  if (result.cleanupStatus !== 'VERIFIED') break;
}

const securitySource = [
  'def square(value):',
  '    import json, os, socket',
  '    paths=("/host", "/run/secrets", "/var/run/secrets", "/root/.config/gcloud", "/root/.aws")',
  '    clean_env=not any(k for k in os.environ if any(x in k.upper() for x in ("TOKEN", "SECRET", "CREDENTIAL", "FIREBASE", "VERCEL", "GOOGLE_APPLICATION")))',
  '    no_paths=not any(os.path.exists(p) for p in paths)',
  '    only_loop=all(name == "lo" for _, name in socket.if_nameindex())',
  '    no_v4_route=not os.path.exists("/proc/net/route") or len(open("/proc/net/route").read().splitlines()) <= 1',
  '    no_v6_route=not os.path.exists("/proc/net/ipv6_route") or not open("/proc/net/ipv6_route").read().strip()',
  '    input_frame=json.loads(open("/work/input.json").read())',
  '    protected_absent="expected" not in input_frame and "tests" not in input_frame',
  '    guest_pid_one="mitutora-init" in open("/proc/1/cmdline", "rb").read().decode("utf-8", "ignore")',
  '    rootfs_read_only=False',
  '    try:',
  '        open("/opt/mitutora/probe", "w").write("x")',
  '    except OSError:',
  '        rootfs_read_only=True',
  '    def blocked(address):',
  '        probe=socket.socket()',
  '        probe.settimeout(0.2)',
  '        try:',
  '            probe.connect(address)',
  '            return False',
  '        except OSError:',
  '            return True',
  '        finally:',
  '            probe.close()',
  '    return all((clean_env, no_paths, only_loop, no_v4_route, no_v6_route, protected_absent, guest_pid_one, rootfs_read_only, blocked(("1.1.1.1", 53)), blocked(("169.254.169.254", 80))))',
].join('\n');
const securityRegistry = registry('synthetic-isolation', 'synthetic-isolation-suite', true);
const securityJudge = new PythonJudge({ registry: securityRegistry, controller: new FirecrackerExecutionController({ worker, runtimeImage }) });
const securityResult = await securityJudge.judge(request('synthetic-isolation', 'synthetic-isolation-suite', 'e'.repeat(64), 'py-real-isolation', securitySource));

const sentinelRegistry = new ProtectedTestRegistry().register({
  suiteId: 'synthetic-sentinel-suite', suiteVersion: 'v1', activityId: 'synthetic-sentinel', activityVersion: 'v1',
  contentHash: 'd'.repeat(64), language: 'python', entryPoint: 'sentinel', tests: [
    { arguments: ['write'], expected: 'written' },
    { arguments: ['inspect'], expected: false },
    { arguments: ['fresh'], expected: 'fresh' },
  ],
});
const sentinelSource = 'def sentinel(action):\n    import os\n    path="/work/MTP_SENTINEL"\n    if action == "write":\n        open(path, "w").write("validation-only")\n        return "written"\n    if action == "inspect":\n        return os.path.exists(path)\n    return "fresh"';
const sentinelJudge = new PythonJudge({ registry: sentinelRegistry, controller: new FirecrackerExecutionController({ worker, runtimeImage }) });
const sentinelResult = await sentinelJudge.judge(request('synthetic-sentinel', 'synthetic-sentinel-suite', 'd'.repeat(64), 'py-real-sentinel', sentinelSource));

const practice = createInitialPracticeProtectedTestRegistry();
const practiceCases = [
  ['fund-variables-001', 'f82864abec10ea3c150af37372e32011ca53fb87868b0d57114230821bc48524', 'practice-fund-variables-001', 'def create_user_label(name, score):\n    return f"{name}: {score}"'],
  ['fund-variables-002', 'f0705f0c0468fd43cfb4f00c912140625b12cdc0bcbb46dc18f8115a238f65c3', 'practice-fund-variables-002', 'def final_inventory(start, sold, restocked):\n    return start - sold + restocked'],
];
const practiceLedger = [];
for (let index = 0; index < practiceCases.length; index += 1) {
  const [activityId, contentHash, suiteId, sourceCode] = practiceCases[index];
  const binding = request(activityId, suiteId, contentHash, `py-real-practice-${index + 1}`, sourceCode, 'v2');
  const judge = new PythonJudge({ registry: practice, controller: new FirecrackerExecutionController({ worker, runtimeImage }) });
  const executor = new PythonJudgeExecutor({ judge, resolveBinding: async () => ({ ...binding, sourceCode: undefined }) });
  const verifier = new PracticeVerifier({ executor });
  const result = await verifier.verify({ request: { activityType: 'PRACTICE', sourceCode }, activity: { language: 'python', verification: { tests: [{}, {}] } }, limits: { executionTimeoutMs: 10_000 } });
  practiceLedger.push({ activityId, passed: result.passed, testCount: result.testCount });
}

const result = Object.freeze({
  runtime: { pythonVersion: manifest.pythonVersion, firecrackerVersion: manifest.firecrackerVersion, guestKernelVersion: manifest.guestKernelVersion },
  digests: { kernel: manifest.kernelDigest, rootfs: manifest.rootfsDigest, runtime: manifest.runtimeDigest },
  synthetic: ledger,
  isolation: { status: securityResult.status, cleanupStatus: securityResult.cleanupStatus, passed: securityResult.status === 'PASS' && securityResult.cleanupStatus === 'VERIFIED' },
  crossRun: { status: sentinelResult.status, cleanupStatus: sentinelResult.cleanupStatus, testsRun: sentinelResult.testsTotal, passed: sentinelResult.status === 'PASS' && sentinelResult.testsPassed === 3 && sentinelResult.cleanupStatus === 'VERIFIED', sentinelLeak: sentinelResult.status === 'PASS' ? 'NO' : 'UNKNOWN' },
  practice: practiceLedger,
});
await writeFile('/tmp/mitutora-python-judge-validation.json', JSON.stringify(result), { mode: 0o600 });
console.log(JSON.stringify(result));
