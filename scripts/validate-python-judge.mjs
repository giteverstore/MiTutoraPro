import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionActivityVerificationBoundary } from '../functions/src/activity-verification/ProductionActivityVerificationBoundary.js';
import { firecrackerWorkerManifest } from '../functions/src/python-judge/FirecrackerWorkerManifest.js';
import { AUTHORITATIVE_JUDGE_STATUS, FIRECRACKER_SECURITY_PROFILE, PYTHON_EXECUTION_POLICY_VERSION, PYTHON_JUDGE_LIMITS, PYTHON_RUNTIME } from '../functions/src/python-judge/JudgePolicy.js';
import { CANONICAL_PYTHON_RUNTIME, canonicalPythonRuntimeImage } from '../functions/src/python-judge/CanonicalPythonRuntime.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const runtimeImage = canonicalPythonRuntimeImage();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(PYTHON_RUNTIME.version === '3.14.0', 'CPython must remain pinned to 3.14.0.');
assert(PYTHON_RUNTIME.firecrackerVersion === '1.16.1', 'Firecracker must remain pinned to 1.16.1.');
assert(CANONICAL_PYTHON_RUNTIME.artifact.generation === '1788850718748121'
  && CANONICAL_PYTHON_RUNTIME.artifact.sha256 === '2e831d37fdb716eb1d09e75878b7209f6eb051510c491041af10acb7ca5d0410'
  && CANONICAL_PYTHON_RUNTIME.kernelDigest === 'd0fa6b694b32c9d12c5b1575180c888d9c83ff8955d21fe74debb4fe4832db22'
  && CANONICAL_PYTHON_RUNTIME.rootfsDigest === '290ebfaa470293ea9f156b83b0257fbf04e533d9d9d49a51c9785b4302aa33ec'
  && CANONICAL_PYTHON_RUNTIME.runtimeDigest === '333b0f4ea024fff35bad974b89990e46f79a8eb19e8fe780963a6942b44d391a'
  && CANONICAL_PYTHON_RUNTIME.harnessDigest === 'a5296f6fefa57123a456e37b131b37b333b05f9623be8b7f23722b1fd6e5e734',
'Canonical Python runtime identity changed unexpectedly.');
assert(PYTHON_EXECUTION_POLICY_VERSION === 'python-firecracker-v1', 'Unexpected execution policy version.');
assert(AUTHORITATIVE_JUDGE_STATUS === 'DEFERRED', 'The authoritative judge must remain deferred for MVP.');
assert(JSON.stringify(PYTHON_JUDGE_LIMITS) === JSON.stringify({
  vcpuCount: 1,
  memoryMiB: 256,
  scratchBytes: 16 * 1024 * 1024,
  pidLimit: 64,
  fileDescriptorLimit: 128,
  maxSourceBytes: 64 * 1024,
  maxTestInputBytes: 64 * 1024,
  maxOutputBytes: 64 * 1024,
  perTestWallTimeMs: 3_000,
  totalWallTimeMs: 10_000,
  vmmFileSizeBytes: 20 * 1024 * 1024,
}), 'Python judge resource limits changed unexpectedly.');
assert(FIRECRACKER_SECURITY_PROFILE.networkAccess === false
  && FIRECRACKER_SECURITY_PROFILE.mmdsEnabled === false
  && FIRECRACKER_SECURITY_PROFILE.credentialsAvailable === false
  && FIRECRACKER_SECURITY_PROFILE.rootfsReadOnly === true
  && FIRECRACKER_SECURITY_PROFILE.jailer === true
  && FIRECRACKER_SECURITY_PROFILE.seccomp === true
  && FIRECRACKER_SECURITY_PROFILE.cgroupVersion === 2,
'Python judge security profile is not fail-closed.');

const manifest = firecrackerWorkerManifest({ executionId: 'validation-only', runtimeImage });
assert(manifest.cgroupKill.endsWith('/cgroup.kill'), 'Firecracker cleanup must retain cgroup.kill.');
assert(manifest.networkInterfaces.length === 0 && manifest.mmds === null, 'Guest networking or MMDS must not be configured.');
assert(manifest.firecrackerConfig.drives[0].is_read_only === true, 'Guest rootfs must remain read-only.');
assert(manifest.jailerArguments.includes('--new-pid-ns'), 'Jailer PID namespace is required.');

assert(productionActivityVerificationBoundary.enabled === false
  && productionActivityVerificationBoundary.endpointExposed === false
  && productionActivityVerificationBoundary.rewardActivationEnabled === false,
'Production verification and rewards must remain disabled.');

const clientRoots = ['src', 'firebase-content'];
const protectedMarkers = ['synthetic-square-suite', 'practice-fund-variables-001', 'practice-fund-variables-002'];
async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }))).flat();
}
for (const relativeRoot of clientRoots) {
  for (const file of await filesUnder(resolve(root, relativeRoot))) {
    const bytes = await readFile(file);
    if (bytes.includes(0)) continue;
    const text = bytes.toString('utf8');
    for (const marker of protectedMarkers) {
      assert(!text.includes(marker), `Protected suite marker leaked into learner-facing path: ${file}`);
    }
  }
}

const boundaryFiles = [
  'functions/src/python-judge/JudgeModels.js',
  'functions/src/python-judge/FirecrackerExecutionController.js',
  'functions/src/python-judge/ExecutionDiagnostics.js',
  'functions/src/python-judge/JailerLaunchContract.js',
  'functions/src/python-judge/GuestProtocol.js',
];
for (const file of boundaryFiles) {
  const text = await readFile(resolve(root, file), 'utf8');
  assert(!/console\.(?:log|info|warn|error)|logger\./.test(text), `${file} must not log source, output, or protected tests.`);
}

const workerSource = await readFile(resolve(root, 'functions/src/python-judge/LinuxFirecrackerWorker.js'), 'utf8');
const controllerSource = await readFile(resolve(root, 'functions/src/python-judge/FirecrackerExecutionController.js'), 'utf8');
const diagnosticSource = await readFile(resolve(root, 'functions/src/python-judge/ExecutionDiagnostics.js'), 'utf8');
const jailerContractSource = await readFile(resolve(root, 'functions/src/python-judge/JailerLaunchContract.js'), 'utf8');
assert(workerSource.includes('CleanupCoordinator')
  && workerSource.includes('async cleanupRuns(handle)')
  && workerSource.includes('async removeCgroup(handle)'),
'Linux worker must retain the explicit mandatory cleanup coordinator.');
assert(controllerSource.indexOf('await this.worker.waitForVmmExit(handle)')
  < controllerSource.indexOf('await this.worker.cleanupRuns(handle)')
  && controllerSource.indexOf('await this.worker.cleanupRuns(handle)')
  < controllerSource.indexOf('await this.worker.removeCgroup(handle)'),
'Controller teardown ordering changed unexpectedly.');
assert(controllerSource.includes('lastExecutionDiagnostic')
  && controllerSource.includes('sanitizedExecutionDiagnostic')
  && controllerSource.includes('getExecutionDiagnosticSnapshot')
  && controllerSource.includes("'RUNTIME_VALIDATE'")
  && controllerSource.includes("'SCRATCH_PREPARE'")
  && workerSource.includes('liveExecutionDiagnosticSnapshot')
  && workerSource.includes('executionDiagnosticStage')
  && diagnosticSource.includes('setLiveExecutionStage')
  && diagnosticSource.includes('FIRECRACKER_SOCKET_WAIT')
  && diagnosticSource.includes('GUEST_RESPONSE_PARSE'),
'Sanitized live execution-stage diagnostics must survive controller timeout without changing result acceptance.');
assert(workerSource.includes("sudo(['install', '-d', '-o', 'root', '-g', 'root', '-m', '0755', jailBase])")
  && workerSource.indexOf("'0755', jailBase") < workerSource.indexOf("atExecutionStage('JAILER_INVOKE'")
  && workerSource.includes('validateJailerLaunchContract')
  && workerSource.includes('JAILER_STDERR_CLASSIFICATION_BYTES')
  && jailerContractSource.includes('JAILER_STDERR_CLASSIFICATION_BYTES = 4 * 1024')
  && jailerContractSource.includes('judge/jailer-unknown-startup-failure'),
'Jailer chroot preparation, pre-launch validation, and bounded diagnostic classification must remain fail-closed.');

console.log(JSON.stringify({
  status: 'pass',
  runtime: `CPython ${PYTHON_RUNTIME.version}`,
  firecracker: PYTHON_RUNTIME.firecrackerVersion,
  protectedContentClientLeaks: 0,
  productionEndpoint: 'disabled',
  rewards: 'disabled',
  canonicalRuntime: 'generation-pinned',
  executableRuntimeProof: 'passed-validation-host',
  authoritativeJudgeStatus: AUTHORITATIVE_JUDGE_STATUS,
}, null, 2));
