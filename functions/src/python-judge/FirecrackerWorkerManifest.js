import { PYTHON_JUDGE_LIMITS, PYTHON_RUNTIME } from './JudgePolicy.js';

const SAFE_EXECUTION_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;

export function firecrackerWorkerManifest({ executionId, runtimeImage }) {
  if (!SAFE_EXECUTION_ID.test(executionId ?? '') || !/^[a-f0-9]{64}$/.test(runtimeImage?.digest ?? '')) {
    throw new TypeError('A safe execution ID and immutable runtime image are required.');
  }
  const jailRoot = `/srv/mitutora-judge/firecracker-${PYTHON_RUNTIME.firecrackerVersion}/${executionId}/root`;
  const cgroup = `/sys/fs/cgroup/firecracker-${PYTHON_RUNTIME.firecrackerVersion}/${executionId}`;
  return Object.freeze({
    executionId,
    runtimeImage: Object.freeze({
      digest: runtimeImage.digest,
      rootfsDigest: runtimeImage.rootfsDigest,
      kernelDigest: runtimeImage.kernelDigest,
      pythonVersion: runtimeImage.pythonVersion,
      guestKernelVersion: runtimeImage.guestKernelVersion,
      firecrackerVersion: runtimeImage.firecrackerVersion,
    }),
    jailRoot,
    cgroup,
    cgroupKill: `${cgroup}/cgroup.kill`,
    pidFile: `${jailRoot}/firecracker.pid`,
    apiSocket: `${jailRoot}/run/firecracker.socket`,
    scratchPath: `${jailRoot}/scratch.ext4`,
    firecrackerConfig: Object.freeze({
      'boot-source': Object.freeze({ kernel_image_path: '/runtime/vmlinux', boot_args: 'console=ttyS0 reboot=k panic=1 pci=off root=/dev/vda ro' }),
      drives: Object.freeze([
        Object.freeze({ drive_id: 'rootfs', path_on_host: '/runtime/rootfs.ext4', is_root_device: true, is_read_only: true }),
        Object.freeze({ drive_id: 'scratch', path_on_host: '/scratch.ext4', is_root_device: false, is_read_only: false }),
      ]),
      'machine-config': Object.freeze({ vcpu_count: PYTHON_JUDGE_LIMITS.vcpuCount, mem_size_mib: PYTHON_JUDGE_LIMITS.memoryMiB, smt: false }),
    }),
    jailerArguments: Object.freeze([
      '--cgroup-version', '2',
      '--cgroup', `memory.max=${PYTHON_JUDGE_LIMITS.memoryMiB * 1024 * 1024 + 128 * 1024 * 1024}`,
      '--cgroup', `pids.max=${PYTHON_JUDGE_LIMITS.pidLimit}`,
      '--resource-limit', `no-file=${PYTHON_JUDGE_LIMITS.fileDescriptorLimit}`,
      '--resource-limit', `fsize=${PYTHON_JUDGE_LIMITS.vmmFileSizeBytes}`,
      '--new-pid-ns',
    ]),
    networkInterfaces: Object.freeze([]),
    mmds: null,
    environment: Object.freeze({}),
  });
}
