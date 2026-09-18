import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createGuestTestFrame, parseGuestResultFrame } from './GuestProtocol.js';
import { firecrackerWorkerManifest } from './FirecrackerWorkerManifest.js';
import { CleanupCoordinator, cleanupFailure } from './CleanupCoordinator.js';
import { pathExists, writeRequiredControl } from './FilesystemSemantics.js';
import { atExecutionStage, executionFailure, liveExecutionDiagnosticSnapshot } from './ExecutionDiagnostics.js';
import { buildJailerInvocation, jailerStartupFailure, JAILER_STDERR_CLASSIFICATION_BYTES, validateJailerLaunchContract } from './JailerLaunchContract.js';

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;

function command(file, args, { input, timeoutMs = 30_000, stderrCaptureBytes = 64 * 1024, failureFactory } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(file, args, { stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' } });
    const stdout = [];
    const stderr = [];
    let size = 0;
    const collect = (target, captureBytes = 64 * 1024) => (chunk) => {
      size += chunk.length;
      const captured = target.reduce((total, value) => total + value.length, 0);
      if (captured < captureBytes) target.push(chunk.subarray(0, captureBytes - captured));
      else child.kill('SIGKILL');
    };
    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr, stderrCaptureBytes));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.once('error', reject);
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0 && size <= 64 * 1024) resolvePromise(Buffer.concat(stdout));
      else {
        const capturedStderr = Buffer.concat(stderr);
        const failure = Object.assign(new Error('Linux worker command failed.'), {
        code: signal ? 'guest/timeout' : 'guest/worker-command',
        exitCode: Number.isInteger(code) ? code : null,
        busy: capturedStderr.toString('utf8').includes('busy'),
        notEmpty: capturedStderr.toString('utf8').includes('not empty'),
        });
        reject(typeof failureFactory === 'function' ? failureFactory(code, signal, capturedStderr) : failure);
      }
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}

async function sudo(args, options) { return command('sudo', ['--non-interactive', ...args], options); }

async function mountTargets() {
  const output = await command('findmnt', ['--raw', '--noheadings', '--output', 'TARGET']);
  return output.toString('utf8').split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
}

async function findAny(root, args) {
  if (!await exists(root)) return false;
  const output = await command('find', [root, ...args, '-print', '-quit']);
  return output.toString('utf8').trim().length > 0;
}

async function exists(path) {
  return pathExists(path);
}

async function killControl(cgroup) {
  const control = `${cgroup}/cgroup.kill`;
  await writeRequiredControl(control, {
    pathExistsOperation: exists,
    writeControl: async () => sudo(['sh', '-c', `printf '1' > '${control}'`]),
  });
}

function sha256File(path) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256');
    const input = createReadStream(path);
    input.once('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.once('end', () => resolvePromise(hash.digest('hex')));
  });
}

export class LinuxFirecrackerWorker {
  constructor({ artifactRoot = '/opt/mitutora-judge/runtime', executionRoot = '/srv/mitutora-judge/executions', jailerPath = '/opt/mitutora-judge/bin/jailer', firecrackerPath = '/opt/mitutora-judge/bin/firecracker' } = {}) {
    if (process.platform !== 'linux') throw new TypeError('LinuxFirecrackerWorker is Linux-only.');
    this.artifactRoot = artifactRoot;
    this.executionRoot = executionRoot;
    this.jailerPath = jailerPath;
    this.firecrackerPath = firecrackerPath;
    this.cleanup = new CleanupCoordinator({
      attempts: 100,
      delayMs: 20,
      operations: {
        mountsUnder: async (root) => (await mountTargets()).filter((target) => target === root || target.startsWith(`${root}/`)),
        unmount: async (target) => sudo(['umount', target]),
        pathExists: async (path, kind) => kind === 'mount'
          ? (await mountTargets()).includes(path)
          : exists(path),
        removeRun: async (runRoot) => sudo(['rm', '-rf', runRoot]),
        remainingResources: async (runRoot) => ({
          socket: await findAny(runRoot, ['-type', 's']),
          scratch: await findAny(runRoot, ['-name', 'scratch.ext4']),
          jail: await findAny(runRoot, ['-type', 'd', '-name', 'jailer']),
          runRoot: await exists(runRoot),
        }),
        cgroupPopulated: async (handle) => {
          if (!await exists(`${handle.cgroup}/cgroup.events`)) return false;
          const events = await readFile(`${handle.cgroup}/cgroup.events`, 'utf8');
          return /^populated 1$/mu.test(events);
        },
        processAlive: async (handle) => Boolean(handle.currentPid && await exists(`/proc/${handle.currentPid}/status`)),
        removeCgroup: async (handle) => sudo(['rmdir', handle.cgroup]),
        wait: (milliseconds) => new Promise((done) => setTimeout(done, milliseconds)),
      },
    });
  }

  async prepare({ executionId, runtimeImage, limits, networkInterfaces, mmds, credentials, rootfsReadOnly }) {
    if (!SAFE_ID.test(executionId) || networkInterfaces !== 0 || mmds !== false || credentials !== null || rootfsReadOnly !== true) {
      throw Object.assign(new Error('Unsafe Firecracker preparation request.'), { code: 'guest/policy' });
    }
    const manifest = firecrackerWorkerManifest({ executionId, runtimeImage });
    const stateRoot = resolve(this.executionRoot, executionId);
    const cgroupParent = '/sys/fs/cgroup/mitutora-python-judge';
    const cgroup = `${cgroupParent}/${executionId}`;
    let stateCreated = false;
    let cgroupCreated = false;
    try {
      await atExecutionStage('PREPARE_EXECUTION_ROOT', 'judge/prepare-failed', async () => {
        await sudo(['install', '-d', '-o', String(process.getuid()), '-g', String(process.getgid()), '-m', '0700', this.executionRoot]);
        await mkdir(stateRoot, { recursive: false });
      });
      stateCreated = true;
      await atExecutionStage('PREPARE_CGROUP', 'judge/cgroup-create-failed', async () => {
        await sudo(['mkdir', '-p', cgroupParent]);
        await sudo(['sh', '-c', `printf '%s' '+memory +pids' > '${cgroupParent}/cgroup.subtree_control'`]);
        await sudo(['mkdir', cgroup]);
      });
      cgroupCreated = true;
      await atExecutionStage('PREPARE_CGROUP', 'judge/cgroup-create-failed', async () => {
        await sudo(['sh', '-c', `printf '%s' '${limits.memoryMiB * 1024 * 1024 + 128 * 1024 * 1024}' > '${cgroup}/memory.max'`]);
        await sudo(['sh', '-c', `printf '%s' '${limits.pidLimit}' > '${cgroup}/pids.max'`]);
      });
      return { executionId, runtimeImage, limits, manifest, stateRoot, cgroup, runIndex: 0, active: new Set(), runs: new Set(), currentPid: null, executionDiagnosticStage: null, executionEvidence: { jailerInvoked: false, socketReady: false, pidAcquired: false, vmStarted: false, responseRead: false } };
    } catch (error) {
      const cleanupErrors = [];
      if (cgroupCreated) {
        try { await killControl(cgroup); }
        catch (cleanupError) { cleanupErrors.push(cleanupFailure('PROCESS_NOT_REAPED', 'PROCESS_TREE_KILLED', 'kill-partial-cgroup', { pathClass: 'execution-cgroup', exitCode: cleanupError?.exitCode })); }
        try { await sudo(['rmdir', cgroup]); }
        catch (cleanupError) { cleanupErrors.push(cleanupFailure('CGROUP_REMOVE_FAILED', 'CGROUP_REMOVED', 'remove-partial-cgroup', { pathClass: 'execution-cgroup', exitCode: cleanupError?.exitCode })); }
      }
      if (stateCreated) {
        try { await rm(stateRoot, { recursive: true, force: true }); }
        catch (cleanupError) { cleanupErrors.push(cleanupFailure('EXECUTION_DIR_NOT_EMPTY', 'EXECUTION_DIR_REMOVED', 'remove-partial-execution', { pathClass: 'execution-root' })); }
      }
      if (cleanupErrors.length) throw cleanupErrors[0];
      throw error;
    }
  }

  async boot(handle) {
    const artifacts = [
      ['vmlinux', handle.runtimeImage.kernelDigest],
      ['rootfs.ext4', handle.runtimeImage.rootfsDigest],
    ];
    for (const [name, expectedDigest] of artifacts) {
      const path = resolve(this.artifactRoot, name);
      await atExecutionStage('RUNTIME_VALIDATE', 'judge/runtime-integrity-failed', async () => {
        if (!await exists(path)) throw Object.assign(new Error('Pinned runtime artifact is missing.'), { code: 'guest/boot' });
        if (await sha256File(path) !== expectedDigest) throw Object.assign(new Error('Pinned runtime artifact integrity check failed.'), { code: 'guest/boot' });
      }, handle.executionEvidence, handle);
    }
    return handle;
  }

  executeTest(handle, test) {
    const task = this.#executeTest(handle, test);
    handle.active.add(task);
    task.finally(() => handle.active.delete(task)).catch(() => {});
    return task;
  }

  getExecutionDiagnosticSnapshot(handle, executionId) {
    return liveExecutionDiagnosticSnapshot(handle, executionId);
  }

  async #executeTest(handle, test) {
    handle.runIndex += 1;
    const runId = `${handle.executionId}-${handle.runIndex}`;
    if (!SAFE_ID.test(runId)) throw Object.assign(new Error('Unsafe run ID.'), { code: 'guest/worker-command' });
    const runRoot = resolve(handle.stateRoot, runId);
    const scratch = resolve(runRoot, 'scratch.ext4');
    const mount = resolve(runRoot, 'scratch');
    const jailBase = resolve(runRoot, 'jailer');
    const jailRoot = resolve(jailBase, 'firecracker', runId, 'root');
    const socket = resolve(jailRoot, 'run', 'firecracker.socket');
    handle.runs.add(runRoot);
    await atExecutionStage('SCRATCH_PREPARE', 'judge/scratch-prepare-failed', async () => {
      await mkdir(mount, { recursive: true });
      await sudo(['install', '-d', '-o', 'root', '-g', 'root', '-m', '0755', jailBase]);
      await command('truncate', ['-s', String(handle.limits.scratchBytes), scratch]);
      await sudo(['mkfs.ext4', '-q', '-F', scratch]);
      await sudo(['mount', '-o', 'nodev,nosuid,noexec', scratch, mount]);
    }, handle.executionEvidence, handle);
    await atExecutionStage('GUEST_REQUEST_WRITE', 'judge/guest-request-write-failed', async () => {
      const frame = createGuestTestFrame(test);
      await sudo(['tee', resolve(mount, 'input.json')], { input: JSON.stringify(frame) });
      await sudo(['truncate', '-s', String(64 * 1024), resolve(mount, 'output.json')]);
      await sudo(['chown', '1001:1001', mount, resolve(mount, 'input.json'), resolve(mount, 'output.json')]);
      await sudo(['chmod', '0700', mount]);
      await sudo(['chmod', '0400', resolve(mount, 'input.json')]);
      await sudo(['chmod', '0600', resolve(mount, 'output.json')]);
      await sudo(['umount', mount]);
    }, handle.executionEvidence, handle);

    await atExecutionStage('JAILER_INVOKE', 'judge/firecracker-spawn-failed', async () => {
      const invocation = buildJailerInvocation({ jailerPath: this.jailerPath, firecrackerPath: this.firecrackerPath, id: runId, chrootBase: jailBase });
      await validateJailerLaunchContract(invocation, { stat, access });
      await sudo([invocation.file, ...invocation.args], {
        stderrCaptureBytes: JAILER_STDERR_CLASSIFICATION_BYTES,
        failureFactory: jailerStartupFailure,
      });
      handle.executionEvidence.jailerInvoked = true;
    }, handle.executionEvidence, handle);
    await atExecutionStage('FIRECRACKER_SOCKET_WAIT', 'judge/firecracker-socket-timeout', async () => {
      const pidFile = resolve(jailRoot, 'run', 'firecracker.pid');
      for (let attempt = 0; attempt < 100 && !await exists(socket); attempt += 1) {
        if (await exists(pidFile)) {
          const earlyPid = Number((await readFile(pidFile, 'utf8')).trim());
          if (Number.isSafeInteger(earlyPid) && earlyPid > 1 && !await exists(`/proc/${earlyPid}/status`)) {
            throw executionFailure(Object.assign(new Error('Firecracker exited before socket readiness.'), { code: 'guest/boot' }), 'FIRECRACKER_SOCKET_WAIT', 'judge/firecracker-exit-before-ready', handle.executionEvidence);
          }
        }
        await new Promise((done) => setTimeout(done, 20));
      }
      if (!await exists(socket)) throw Object.assign(new Error('Firecracker API socket unavailable.'), { code: 'guest/boot', timedOut: true });
      handle.executionEvidence.socketReady = true;
    }, handle.executionEvidence, handle);

    await atExecutionStage('JAIL_PREPARE', 'judge/jail-prepare-failed', async () => {
      await sudo(['cp', resolve(this.artifactRoot, 'vmlinux'), resolve(jailRoot, 'vmlinux')]);
      await sudo(['cp', resolve(this.artifactRoot, 'rootfs.ext4'), resolve(jailRoot, 'rootfs.ext4')]);
      await sudo(['cp', scratch, resolve(jailRoot, 'scratch.ext4')]);
      await sudo(['chmod', '0444', resolve(jailRoot, 'vmlinux'), resolve(jailRoot, 'rootfs.ext4')]);
      await sudo(['chown', '1001:1001', resolve(jailRoot, 'vmlinux'), resolve(jailRoot, 'rootfs.ext4'), resolve(jailRoot, 'scratch.ext4')]);
    }, handle.executionEvidence, handle);

    const api = async (path, body) => sudo(['curl', '--fail', '--silent', '--show-error', '--unix-socket', socket,
        '-X', 'PUT', `http://localhost${path}`, '-H', 'Content-Type: application/json', '--data-binary', JSON.stringify(body)]);
    await atExecutionStage('VM_CONFIG_BOOT_SOURCE', 'judge/firecracker-api-failed', () => api('/boot-source', { kernel_image_path: '/vmlinux', boot_args: 'console=ttyS0 reboot=k panic=1 pci=off root=/dev/vda ro init=/usr/local/bin/mitutora-init' }), handle.executionEvidence, handle);
    await atExecutionStage('VM_CONFIG_ROOT_DRIVE', 'judge/firecracker-api-failed', () => api('/drives/rootfs', { drive_id: 'rootfs', path_on_host: '/rootfs.ext4', is_root_device: true, is_read_only: true }), handle.executionEvidence, handle);
    await atExecutionStage('VM_CONFIG_SCRATCH_DRIVE', 'judge/firecracker-api-failed', () => api('/drives/scratch', { drive_id: 'scratch', path_on_host: '/scratch.ext4', is_root_device: false, is_read_only: false }), handle.executionEvidence, handle);
    await atExecutionStage('VM_CONFIG_MACHINE', 'judge/vm-config-failed', () => api('/machine-config', { vcpu_count: handle.limits.vcpuCount, mem_size_mib: handle.limits.memoryMiB, smt: false }), handle.executionEvidence, handle);
    const pid = await atExecutionStage('FIRECRACKER_PID_ACQUIRE', 'judge/firecracker-exit-before-ready', async () => {
      const value = Number((await sudo(['cat', resolve(jailRoot, 'run', 'firecracker.pid')])).toString('utf8').trim());
      if (!Number.isSafeInteger(value) || value <= 1) throw Object.assign(new Error('Invalid VMM PID.'), { code: 'guest/boot' });
      return value;
    }, handle.executionEvidence, handle);
    handle.currentPid = pid;
    handle.executionEvidence.pidAcquired = true;
    await atExecutionStage('CGROUP_ATTACH', 'judge/cgroup-create-failed', () => sudo(['sh', '-c', `printf '%s' '${pid}' > '${handle.cgroup}/cgroup.procs'`]), handle.executionEvidence, handle);
    await atExecutionStage('VM_START', 'judge/vm-start-failed', () => api('/actions', { action_type: 'InstanceStart' }), handle.executionEvidence, handle);
    handle.executionEvidence.vmStarted = true;

    await atExecutionStage('GUEST_EXECUTION_WAIT', 'judge/guest-protocol-timeout', async () => {
      const deadline = Date.now() + test.timeoutMs;
      while (Date.now() < deadline && await exists(`/proc/${pid}/status`)) await new Promise((done) => setTimeout(done, 20));
      if (await exists(`/proc/${pid}/status`)) throw Object.assign(new Error('Guest timeout.'), { code: 'guest/timeout' });
      handle.currentPid = null;
    }, handle.executionEvidence, handle);

    const output = await atExecutionStage('GUEST_RESPONSE_READ', 'judge/guest-response-read-failed', async () => {
      const jailedScratch = resolve(jailRoot, 'scratch.ext4');
      await sudo(['mount', '-o', 'ro,nodev,nosuid,noexec', jailedScratch, mount]);
      const bytes = await readFile(resolve(mount, 'output.json'));
      await sudo(['umount', mount]);
      handle.executionEvidence.responseRead = true;
      return bytes;
    }, handle.executionEvidence, handle);
    return atExecutionStage('GUEST_RESPONSE_PARSE', 'judge/guest-response-invalid', () => parseGuestResultFrame(output), handle.executionEvidence, handle);
  }

  async requestShutdown() {}

  async isVmmAlive(handle) {
    if (handle.currentPid && await exists(`/proc/${handle.currentPid}/status`)) return true;
    if (!await exists(`${handle.cgroup}/cgroup.procs`)) return false;
    return (await readFile(`${handle.cgroup}/cgroup.procs`, 'utf8')).trim().length > 0;
  }

  async killCgroup(handle) {
    if (!await exists(handle.cgroup)) return;
    await killControl(handle.cgroup);
  }

  async waitForVmmExit(handle) {
    if (handle.active.size) await Promise.allSettled([...handle.active]);
    await this.cleanup.waitForProcesses(handle);
    handle.currentPid = null;
  }

  async cleanupRuns(handle) { await this.cleanup.cleanupRuns(handle); }

  async removeCgroup(handle) { await this.cleanup.removeCgroup(handle); }

  async verifyCleanup(handle) {
    const cgroupGone = !await exists(handle.cgroup);
    const vmmPidGone = !handle.currentPid || !await exists(`/proc/${handle.currentPid}/status`);
    const targets = await mountTargets();
    const mountsGone = !targets.some((target) => target === handle.stateRoot || target.startsWith(`${handle.stateRoot}/`));
    const socketsGone = !await findAny(handle.stateRoot, ['-type', 's']);
    const jailGone = !await findAny(handle.stateRoot, ['-type', 'd', '-name', 'jailer']);
    const scratchGone = !await findAny(handle.stateRoot, ['-name', 'scratch.ext4']);
    const runStateGone = handle.runs.size === 0 && !await findAny(handle.stateRoot, ['-mindepth', '1']);
    return Object.freeze({
      vmmPidGone,
      guestProcessesGone: vmmPidGone && cgroupGone,
      cgroupGone,
      mountsGone,
      socketsGone: runStateGone && socketsGone,
      jailGone: runStateGone && jailGone,
      scratchGone: runStateGone && scratchGone,
    });
  }

  async removeExecution(handle) { await rm(handle.stateRoot, { recursive: true, force: true }); }
}
