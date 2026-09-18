const SAFE_STAGES = new Set([
  'PREPARE_EXECUTION_ROOT', 'PREPARE_CGROUP', 'RUNTIME_VALIDATE', 'SCRATCH_PREPARE',
  'GUEST_REQUEST_WRITE', 'JAILER_INVOKE', 'FIRECRACKER_SOCKET_WAIT', 'JAIL_PREPARE',
  'VM_CONFIG_BOOT_SOURCE', 'VM_CONFIG_ROOT_DRIVE', 'VM_CONFIG_SCRATCH_DRIVE',
  'VM_CONFIG_MACHINE', 'FIRECRACKER_PID_ACQUIRE', 'CGROUP_ATTACH', 'VM_START',
  'GUEST_EXECUTION_WAIT', 'GUEST_RESPONSE_READ', 'GUEST_RESPONSE_PARSE', 'RESULT_VALIDATE',
]);

const SAFE_REASONS = new Set([
  'judge/prepare-failed', 'judge/cgroup-create-failed', 'judge/runtime-integrity-failed',
  'judge/scratch-prepare-failed', 'judge/guest-request-write-failed',
  'judge/firecracker-spawn-failed', 'judge/firecracker-exit-before-ready',
  'judge/jailer-invalid-arguments', 'judge/jailer-exec-file-invalid',
  'judge/jailer-permission-denied', 'judge/jailer-chroot-failed',
  'judge/jailer-cgroup-failed', 'judge/jailer-namespace-failed',
  'judge/jailer-exec-failed', 'judge/jailer-unknown-startup-failure',
  'judge/firecracker-socket-timeout', 'judge/jail-prepare-failed',
  'judge/firecracker-api-failed', 'judge/vm-config-failed', 'judge/vm-start-failed',
  'judge/guest-protocol-timeout', 'judge/guest-response-read-failed',
  'judge/guest-response-invalid', 'judge/guest-result-invalid',
]);

const SAFE_SIGNALS = new Set(['SIGABRT', 'SIGALRM', 'SIGBUS', 'SIGFPE', 'SIGHUP', 'SIGILL', 'SIGINT', 'SIGKILL', 'SIGPIPE', 'SIGQUIT', 'SIGSEGV', 'SIGTERM', 'SIGTRAP']);
const SAFE_ERRNOS = new Set(['EACCES', 'EBUSY', 'EEXIST', 'EINVAL', 'EIO', 'ENOENT', 'ENOMEM', 'ENOSPC', 'ENOTDIR', 'ENOTEMPTY', 'EPERM', 'EROFS', 'ETIMEDOUT']);

function safeEvidence(evidence = {}) {
  return Object.freeze({
    jailerInvoked: evidence.jailerInvoked === true,
    socketReady: evidence.socketReady === true,
    pidAcquired: evidence.pidAcquired === true,
    vmStarted: evidence.vmStarted === true,
    responseRead: evidence.responseRead === true,
  });
}

export function setLiveExecutionStage(context, executionId, stage, reasonCode) {
  if (!context || context.executionId !== executionId) return;
  context.executionDiagnosticStage = Object.freeze({
    executionId,
    stage: SAFE_STAGES.has(stage) ? stage : 'RESULT_VALIDATE',
    reasonCode: SAFE_REASONS.has(reasonCode) ? reasonCode : 'judge/guest-result-invalid',
  });
}

export function liveExecutionDiagnosticSnapshot(context, executionId) {
  const current = context?.executionDiagnosticStage;
  if (!current || current.executionId !== executionId || context.executionId !== executionId) return null;
  return Object.freeze({
    executionId,
    stage: current.stage,
    reasonCode: current.reasonCode,
    evidence: safeEvidence(context.executionEvidence),
  });
}

export function executionFailure(error, stage, reasonCode, evidence = {}) {
  if (error?.executionStage) return error;
  const failure = new Error('Judge execution stage failed.');
  failure.code = typeof error?.code === 'string' ? error.code : 'guest/worker-command';
  failure.executionStage = SAFE_STAGES.has(stage) ? stage : 'RESULT_VALIDATE';
  failure.executionReasonCode = SAFE_REASONS.has(reasonCode) ? reasonCode : 'judge/guest-result-invalid';
  failure.executionExitCode = Number.isInteger(error?.exitCode) ? error.exitCode : null;
  failure.executionSignal = SAFE_SIGNALS.has(error?.signal) ? error.signal : null;
  failure.executionErrno = SAFE_ERRNOS.has(error?.code) ? error.code : (SAFE_ERRNOS.has(error?.errno) ? error.errno : null);
  failure.executionTimedOut = error?.code === 'guest/timeout' || error?.timedOut === true;
  failure.executionEvidence = safeEvidence(evidence);
  return failure;
}

export function sanitizedExecutionDiagnostic(executionId, error) {
  if (!error?.executionStage) return Object.freeze({
    executionId,
    stage: 'RESULT_VALIDATE',
    reasonCode: 'judge/guest-result-invalid',
    originalCode: typeof error?.code === 'string' ? error.code : null,
    exitCode: null,
    signal: null,
    errno: null,
    timedOut: error?.code === 'guest/timeout',
    evidence: Object.freeze({ jailerInvoked: false, socketReady: false, pidAcquired: false, vmStarted: false, responseRead: false }),
  });
  return Object.freeze({
    executionId,
    stage: error.executionStage,
    reasonCode: error.executionReasonCode,
    originalCode: typeof error.code === 'string' ? error.code : null,
    exitCode: Number.isInteger(error.executionExitCode) ? error.executionExitCode : null,
    signal: error.executionSignal ?? null,
    errno: error.executionErrno ?? null,
    timedOut: error.executionTimedOut === true,
    evidence: error.executionEvidence,
  });
}

export async function atExecutionStage(stage, reasonCode, operation, evidence, context) {
  if (context) setLiveExecutionStage(context, context.executionId, stage, reasonCode);
  try {
    return await operation();
  } catch (error) {
    throw executionFailure(error, stage, error?.executionReasonCode ?? reasonCode, evidence);
  }
}
