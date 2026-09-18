import { describe, expect, it, vi } from 'vitest';
import { CleanupCoordinator, deepestMountsFirst, sanitizedCleanupDiagnostic } from '../../functions/src/python-judge/CleanupCoordinator.js';

function fixture(options = {}) {
  const state = {
    mounts: new Set(options.mounts ?? ['/exec/run/scratch']),
    paths: new Set(options.paths ?? ['/exec/run', '/exec/run/scratch.ext4', '/cgroup/run']),
    populated: [...(options.populated ?? [false])],
    alive: [...(options.alive ?? [false])],
    unmountFailures: options.unmountFailures ?? 0,
    removeRunError: options.removeRunError,
    cgroupRemoveFailures: options.cgroupRemoveFailures ?? 0,
    order: [],
  };
  const operations = {
    mountsUnder: vi.fn(async (root) => [...state.mounts].filter((path) => path === root || path.startsWith(`${root}/`))),
    unmount: vi.fn(async (path) => {
      state.order.push(`unmount:${path}`);
      if (state.unmountFailures > 0) { state.unmountFailures -= 1; throw Object.assign(new Error('busy'), { busy: true, exitCode: 32 }); }
      state.mounts.delete(path);
    }),
    pathExists: vi.fn(async (path, kind) => kind === 'mount' ? state.mounts.has(path) : state.paths.has(path)),
    removeRun: vi.fn(async (path) => {
      state.order.push(`remove:${path}`);
      if (state.mounts.size) throw Object.assign(new Error('busy'), { busy: true, exitCode: 16 });
      if (state.removeRunError) throw state.removeRunError;
      for (const entry of [...state.paths]) if (entry === path || entry.startsWith(`${path}/`)) state.paths.delete(entry);
    }),
    remainingResources: vi.fn(async (path) => ({
      socket: state.paths.has(`${path}/firecracker.socket`),
      scratch: state.paths.has(`${path}/scratch.ext4`),
      jail: state.paths.has(`${path}/jailer`),
      runRoot: state.paths.has(path),
    })),
    cgroupPopulated: vi.fn(async () => state.populated.length > 1 ? state.populated.shift() : state.populated[0]),
    processAlive: vi.fn(async () => state.alive.length > 1 ? state.alive.shift() : state.alive[0]),
    removeCgroup: vi.fn(async () => {
      state.order.push('remove-cgroup');
      if (state.cgroupRemoveFailures > 0) { state.cgroupRemoveFailures -= 1; throw Object.assign(new Error('not empty'), { notEmpty: true, exitCode: 1 }); }
      state.paths.delete('/cgroup/run');
    }),
    wait: vi.fn(async () => {}),
  };
  const coordinator = new CleanupCoordinator({ operations, attempts: options.attempts ?? 3, delayMs: 0 });
  const handle = { cgroup: '/cgroup/run', currentPid: 12, runs: new Set(['/exec/run']) };
  return { state, operations, coordinator, handle };
}

describe('Firecracker cleanup coordinator', () => {
  it('sorts nested mounts deepest-first', () => {
    expect(deepestMountsFirst(['/exec/run', '/exec/run/a/b', '/exec/run/a'])).toEqual(['/exec/run/a/b', '/exec/run/a', '/exec/run']);
  });

  it('retries a mount that is busy once and then removes the run', async () => {
    const value = fixture({ unmountFailures: 1 });
    await value.coordinator.cleanupRuns(value.handle);
    expect(value.operations.unmount).toHaveBeenCalledTimes(2);
    expect(value.state.order).toEqual(['unmount:/exec/run/scratch', 'unmount:/exec/run/scratch', 'remove:/exec/run']);
  });

  it('fails closed when a mount remains permanently busy', async () => {
    const value = fixture({ unmountFailures: 3 });
    await expect(value.coordinator.cleanupRuns(value.handle)).rejects.toMatchObject({ code: 'UNMOUNT_BUSY', cleanupStage: 'MOUNTS_REMOVED', cleanupRetry: 3 });
    expect(value.operations.removeRun).not.toHaveBeenCalled();
  });

  it('never removes scratch/run storage before its mount is gone', async () => {
    const value = fixture();
    await value.coordinator.cleanupRuns(value.handle);
    expect(value.state.order.indexOf('unmount:/exec/run/scratch')).toBeLessThan(value.state.order.indexOf('remove:/exec/run'));
  });

  it('classifies ENOTEMPTY while removing an execution directory', async () => {
    const value = fixture({ mounts: [], paths: ['/exec/run', '/cgroup/run'], removeRunError: Object.assign(new Error('not empty'), { notEmpty: true, exitCode: 39 }) });
    await expect(value.coordinator.cleanupRuns(value.handle)).rejects.toMatchObject({ code: 'EXECUTION_DIR_NOT_EMPTY', cleanupExitCode: 39 });
  });

  it.each([
    ['firecracker.socket', 'SOCKET_REMOVE_FAILED'],
    ['scratch.ext4', 'SCRATCH_REMOVE_FAILED'],
    ['jailer', 'JAIL_REMOVE_FAILED'],
  ])('classifies retained %s precisely', async (entry, code) => {
    const value = fixture({ mounts: [], paths: ['/exec/run', `/exec/run/${entry}`, '/cgroup/run'], removeRunError: Object.assign(new Error('remove'), { exitCode: 1 }) });
    await expect(value.coordinator.cleanupRuns(value.handle)).rejects.toMatchObject({ code });
  });

  it('waits for cgroup populated state to become empty', async () => {
    const value = fixture({ mounts: [], populated: [true, false], alive: [false, false] });
    await expect(value.coordinator.waitForProcesses(value.handle)).resolves.toBeUndefined();
    expect(value.operations.cgroupPopulated).toHaveBeenCalledTimes(2);
  });

  it('fails closed when a cgroup never becomes empty', async () => {
    const value = fixture({ mounts: [], populated: [true], attempts: 2 });
    await expect(value.coordinator.waitForProcesses(value.handle)).rejects.toMatchObject({ code: 'PROCESS_NOT_REAPED', cleanupRetry: 2 });
  });

  it('waits for a known Firecracker process to be reaped', async () => {
    const value = fixture({ mounts: [], populated: [false, false], alive: [true, false] });
    await expect(value.coordinator.waitForProcesses(value.handle)).resolves.toBeUndefined();
  });

  it('cleans a remaining mount after Firecracker already exited', async () => {
    const value = fixture({ populated: [false], alive: [false] });
    await value.coordinator.waitForProcesses(value.handle);
    await value.coordinator.cleanupRuns(value.handle);
    expect(value.state.mounts.size).toBe(0);
  });

  it('cleans a remaining mount after jailer already exited', async () => {
    const value = fixture({ populated: [false], alive: [false] });
    await value.coordinator.cleanupRuns(value.handle);
    expect(value.handle.runs.size).toBe(0);
  });

  it('is idempotent when run cleanup is invoked twice', async () => {
    const value = fixture();
    await value.coordinator.cleanupRuns(value.handle);
    await value.coordinator.cleanupRuns(value.handle);
    expect(value.operations.removeRun).toHaveBeenCalledOnce();
  });

  it('removes a cgroup only after it is empty', async () => {
    const value = fixture({ mounts: [], populated: [false] });
    await value.coordinator.removeCgroup(value.handle);
    expect(value.state.paths.has('/cgroup/run')).toBe(false);
  });

  it('cleans a partial prepare handle with no run directory', async () => {
    const value = fixture({ mounts: [], paths: ['/cgroup/run'] });
    value.handle.runs.clear();
    await value.coordinator.waitForProcesses(value.handle);
    await value.coordinator.cleanupRuns(value.handle);
    await value.coordinator.removeCgroup(value.handle);
    expect(value.state.paths.size).toBe(0);
  });

  it('cleans failure after scratch mount but before guest boot', async () => {
    const value = fixture();
    await value.coordinator.cleanupRuns(value.handle);
    expect(value.state.mounts.size).toBe(0);
    expect(value.handle.runs.size).toBe(0);
  });

  it('cleans failure after guest execution but before result handling', async () => {
    const value = fixture({ mounts: ['/exec/run/scratch'], paths: ['/exec/run', '/exec/run/jailer', '/exec/run/scratch.ext4', '/cgroup/run'] });
    await value.coordinator.cleanupRuns(value.handle);
    expect(value.state.paths.has('/exec/run')).toBe(false);
  });

  it('retries transient cgroup removal failure', async () => {
    const value = fixture({ mounts: [], populated: [false], cgroupRemoveFailures: 1 });
    await value.coordinator.removeCgroup(value.handle);
    expect(value.operations.removeCgroup).toHaveBeenCalledTimes(2);
  });

  it('fails closed when cgroup removal never succeeds', async () => {
    const value = fixture({ mounts: [], populated: [false], cgroupRemoveFailures: 3 });
    await expect(value.coordinator.removeCgroup(value.handle)).rejects.toMatchObject({ code: 'CGROUP_REMOVE_FAILED', cleanupRetry: 3 });
  });

  it('reproduces and clears the complete R.5 residue fixture', async () => {
    const value = fixture();
    await value.coordinator.waitForProcesses(value.handle);
    await value.coordinator.cleanupRuns(value.handle);
    await value.coordinator.removeCgroup(value.handle);
    expect({ mounts: value.state.mounts.size, runs: value.handle.runs.size, cgroup: value.state.paths.has('/cgroup/run'), scratch: value.state.paths.has('/exec/run/scratch.ext4') }).toEqual({ mounts: 0, runs: 0, cgroup: false, scratch: false });
  });

  it('returns bounded diagnostics without raw paths or error text', () => {
    const error = Object.assign(new Error('private /exec/run detail'), { code: 'UNMOUNT_BUSY', cleanupStage: 'MOUNTS_REMOVED', cleanupOperation: 'unmount', cleanupPathClass: 'run-descendant-mount', cleanupExitCode: 32, cleanupRetry: 3 });
    const diagnostic = sanitizedCleanupDiagnostic('safe-id', error);
    expect(diagnostic).toEqual({ executionId: 'safe-id', stage: 'MOUNTS_REMOVED', code: 'UNMOUNT_BUSY', operation: 'unmount', exitCode: 32, pathClass: 'run-descendant-mount', retry: 3 });
    expect(JSON.stringify(diagnostic)).not.toContain('/exec/run');
  });
});
