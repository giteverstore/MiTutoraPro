import { readFile, writeFile } from 'node:fs/promises';
import { FirecrackerExecutionController } from '../../functions/src/python-judge/FirecrackerExecutionController.js';
import { LinuxFirecrackerWorker } from '../../functions/src/python-judge/LinuxFirecrackerWorker.js';
import { PYTHON_EXECUTION_POLICY_VERSION, PYTHON_RUNTIME } from '../../functions/src/python-judge/JudgePolicy.js';
import { ProtectedTestRegistry } from '../../functions/src/python-judge/ProtectedTestRegistry.js';
import { PythonJudge } from '../../functions/src/python-judge/PythonJudge.js';
import { CANONICAL_PYTHON_RUNTIME, canonicalPythonRuntimeImage } from '../../functions/src/python-judge/CanonicalPythonRuntime.js';

const manifest = JSON.parse(await readFile('/opt/mitutora-judge/runtime/manifest.json', 'utf8'));
for (const field of ['runtimeDigest', 'rootfsDigest', 'kernelDigest', 'harnessDigest']) {
  if (manifest[field] !== CANONICAL_PYTHON_RUNTIME[field]) throw new Error(`Canonical runtime manifest mismatch: ${field}.`);
}
const runtimeImage = canonicalPythonRuntimeImage();
const worker = new LinuxFirecrackerWorker();

function request({ executionId, activityId, suiteId, contentHash, sourceCode }) {
  return Object.freeze({
    activityId,
    activityVersion: 'v1',
    contentHash,
    language: 'python',
    runtimeVersion: PYTHON_RUNTIME.version,
    sourceCode,
    protectedSuiteId: suiteId,
    protectedSuiteVersion: 'v1',
    runtimeImageDigest: runtimeImage.digest,
    executionPolicyVersion: PYTHON_EXECUTION_POLICY_VERSION,
    executionId,
  });
}

async function execute(spec) {
  const registry = new ProtectedTestRegistry().register({
    suiteId: spec.suiteId,
    suiteVersion: 'v1',
    activityId: spec.activityId,
    activityVersion: 'v1',
    contentHash: spec.contentHash,
    language: 'python',
    entryPoint: spec.entryPoint,
    tests: [{ arguments: spec.arguments, expected: spec.expected }],
  });
  const controller = new FirecrackerExecutionController({ worker, runtimeImage });
  const judge = new PythonJudge({ registry, controller });
  const started = Date.now();
  const result = await judge.judge(request(spec));
  return Object.freeze({
    caseId: spec.caseId,
    status: result.status,
    cleanupStatus: result.cleanupStatus,
    cleanupCode: controller.lastCleanupDiagnostic?.code ?? null,
    durationClass: Date.now() - started < 5_000 ? 'under-5s' : '5s-or-more',
    passed: result.status === spec.expectedStatus && result.cleanupStatus === 'VERIFIED',
  });
}

const specs = Object.freeze([
  Object.freeze({
    caseId: 'minimal-cleanup', executionId: 'py-cleanup-minimal', activityId: 'synthetic-cleanup-minimal',
    suiteId: 'synthetic-cleanup-minimal-suite', contentHash: '1'.repeat(64), entryPoint: 'ping',
    arguments: [], expected: 1, expectedStatus: 'PASS', sourceCode: 'def ping():\n    return 1',
  }),
  Object.freeze({
    caseId: 'correct-trivial', executionId: 'py-cleanup-correct', activityId: 'synthetic-cleanup-correct',
    suiteId: 'synthetic-cleanup-correct-suite', contentHash: '2'.repeat(64), entryPoint: 'square',
    arguments: [3], expected: 9, expectedStatus: 'PASS', sourceCode: 'def square(value):\n    return value * value',
  }),
  Object.freeze({
    caseId: 'timeout', executionId: 'py-cleanup-timeout', activityId: 'synthetic-cleanup-timeout',
    suiteId: 'synthetic-cleanup-timeout-suite', contentHash: '3'.repeat(64), entryPoint: 'spin',
    arguments: [], expected: null, expectedStatus: 'TIMEOUT', sourceCode: 'def spin():\n    while True:\n        pass',
  }),
]);

const executions = [];
for (const spec of specs) {
  const result = await execute(spec);
  executions.push(result);
  if (!result.passed) break;
}

const report = Object.freeze({
  runtime: Object.freeze({ pythonVersion: manifest.pythonVersion, firecrackerVersion: manifest.firecrackerVersion }),
  executions,
  passed: executions.length === specs.length && executions.every((entry) => entry.passed),
});
await writeFile('/tmp/mitutora-python-judge-cleanup-retest.json', JSON.stringify(report), { mode: 0o600 });
console.log(JSON.stringify(report));
