const DEFAULT_ATTEMPTS = 5;
const DEFAULT_DELAY_MS = 50;

export function cleanupFailure(code, stage, operation, options = {}) {
  return Object.assign(new Error('Mandatory judge cleanup operation failed.'), {
    code,
    cleanupStage: stage,
    cleanupOperation: operation,
    cleanupPathClass: options.pathClass ?? null,
    cleanupExitCode: Number.isInteger(options.exitCode) ? options.exitCode : null,
    cleanupRetry: Number.isInteger(options.retry) ? options.retry : null,
  });
}

export function deepestMountsFirst(paths) {
  return [...new Set(paths)].sort((left, right) => {
    const depth = (value) => value.split('/').filter(Boolean).length;
    return depth(right) - depth(left) || right.localeCompare(left);
  });
}

export class CleanupCoordinator {
  constructor({ operations, attempts = DEFAULT_ATTEMPTS, delayMs = DEFAULT_DELAY_MS }) {
    const required = ['mountsUnder', 'unmount', 'pathExists', 'removeRun', 'remainingResources', 'cgroupPopulated', 'processAlive', 'removeCgroup', 'wait'];
    if (!operations || !required.every((name) => typeof operations[name] === 'function')) throw new TypeError('Complete cleanup operations are required.');
    if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 100 || !Number.isSafeInteger(delayMs) || delayMs < 0 || delayMs > 1_000) {
      throw new TypeError('Bounded cleanup retry policy is required.');
    }
    this.operations = operations;
    this.attempts = attempts;
    this.delayMs = delayMs;
  }

  async #pause() { if (this.delayMs) await this.operations.wait(this.delayMs); }

  async waitForProcesses(handle) {
    for (let retry = 0; retry < this.attempts; retry += 1) {
      const populated = await this.operations.cgroupPopulated(handle);
      const processAlive = await this.operations.processAlive(handle);
      if (!populated && !processAlive) return;
      if (retry + 1 < this.attempts) await this.#pause();
    }
    throw cleanupFailure('PROCESS_NOT_REAPED', 'PROCESSES_REAPED', 'wait-process-tree', { pathClass: 'execution-cgroup', retry: this.attempts });
  }

  async cleanupRuns(handle) {
    for (const runRoot of [...handle.runs]) {
      const mounts = deepestMountsFirst(await this.operations.mountsUnder(runRoot));
      for (const mount of mounts) {
        let lastError;
        for (let retry = 0; retry < this.attempts; retry += 1) {
          if (!await this.operations.pathExists(mount, 'mount')) break;
          try { await this.operations.unmount(mount); } catch (error) { lastError = error; }
          if (!await this.operations.pathExists(mount, 'mount')) break;
          if (retry + 1 < this.attempts) await this.#pause();
        }
        if (await this.operations.pathExists(mount, 'mount')) {
          throw cleanupFailure(lastError?.busy ? 'UNMOUNT_BUSY' : 'UNMOUNT_FAILED', 'MOUNTS_REMOVED', 'unmount', {
            pathClass: 'run-descendant-mount', exitCode: lastError?.exitCode, retry: this.attempts,
          });
        }
      }
      let removeError;
      try { await this.operations.removeRun(runRoot); } catch (error) { removeError = error; }
      const remaining = await this.operations.remainingResources(runRoot);
      if (remaining.socket) {
        throw cleanupFailure('SOCKET_REMOVE_FAILED', 'SOCKETS_REMOVED', 'remove-run', { pathClass: 'run-socket', exitCode: removeError?.exitCode });
      }
      if (remaining.scratch) {
        throw cleanupFailure('SCRATCH_REMOVE_FAILED', 'SCRATCH_REMOVED', 'remove-run', { pathClass: 'scratch-backing-file', exitCode: removeError?.exitCode });
      }
      if (remaining.jail) {
        throw cleanupFailure('JAIL_REMOVE_FAILED', 'JAIL_REMOVED', 'remove-run', { pathClass: 'run-jail', exitCode: removeError?.exitCode });
      }
      if (removeError || remaining.runRoot) {
        throw cleanupFailure('EXECUTION_DIR_NOT_EMPTY', 'EXECUTION_DIR_REMOVED', 'remove-run', {
          pathClass: 'run-root', exitCode: removeError?.exitCode,
        });
      }
      handle.runs.delete(runRoot);
    }
  }

  async removeCgroup(handle) {
    if (!await this.operations.pathExists(handle.cgroup, 'path')) return;
    if (await this.operations.cgroupPopulated(handle)) {
      throw cleanupFailure('CGROUP_NOT_EMPTY', 'CGROUP_EMPTY', 'verify-cgroup-empty', { pathClass: 'execution-cgroup' });
    }
    let lastError;
    for (let retry = 0; retry < this.attempts; retry += 1) {
      try { await this.operations.removeCgroup(handle); } catch (error) { lastError = error; }
      if (!await this.operations.pathExists(handle.cgroup, 'path')) return;
      if (retry + 1 < this.attempts) await this.#pause();
    }
    throw cleanupFailure('CGROUP_REMOVE_FAILED', 'CGROUP_REMOVED', 'remove-cgroup', {
      pathClass: 'execution-cgroup', exitCode: lastError?.exitCode, retry: this.attempts,
    });
  }
}

export function sanitizedCleanupDiagnostic(executionId, error) {
  return Object.freeze({
    executionId,
    stage: error?.cleanupStage ?? 'UNKNOWN',
    code: error?.code ?? 'UNKNOWN_CLEANUP_FAILURE',
    operation: error?.cleanupOperation ?? null,
    exitCode: Number.isInteger(error?.cleanupExitCode) ? error.cleanupExitCode : null,
    pathClass: error?.cleanupPathClass ?? null,
    retry: Number.isInteger(error?.cleanupRetry) ? error.cleanupRetry : null,
  });
}
