import { CANONICAL_PYTHON_RUNTIME } from './CanonicalPythonRuntime.js';

export const PYTHON_JUDGE_VERSION = 'm2.3b.1-v1';
export const PYTHON_EXECUTION_POLICY_VERSION = 'python-firecracker-v1';
export const AUTHORITATIVE_JUDGE_STATUS = 'DEFERRED';

export const PYTHON_RUNTIME = Object.freeze({
  language: 'python',
  version: CANONICAL_PYTHON_RUNTIME.pythonVersion,
  firecrackerVersion: CANONICAL_PYTHON_RUNTIME.firecrackerVersion,
  guestKernelVersion: CANONICAL_PYTHON_RUNTIME.guestKernelVersion,
});

export const PYTHON_JUDGE_LIMITS = Object.freeze({
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
});

export const FIRECRACKER_SECURITY_PROFILE = Object.freeze({
  isolated: true,
  hardTimeout: true,
  networkAccess: false,
  filesystemAccess: false,
  mmdsEnabled: false,
  credentialsAvailable: false,
  rootfsReadOnly: true,
  jailer: true,
  seccomp: true,
  cgroupVersion: 2,
  steadyStateRoot: false,
  memoryLimitBytes: PYTHON_JUDGE_LIMITS.memoryMiB * 1024 * 1024,
  outputLimitBytes: PYTHON_JUDGE_LIMITS.maxOutputBytes,
});
