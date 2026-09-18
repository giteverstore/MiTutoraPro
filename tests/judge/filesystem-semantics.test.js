import { describe, expect, it, vi } from 'vitest';
import { pathExists, writeRequiredControl } from '../../functions/src/python-judge/FilesystemSemantics.js';

describe('judge filesystem operation semantics', () => {
  it('detects a write-only cgroup control through metadata without reading it', async () => {
    const statPath = vi.fn().mockResolvedValue({});
    const readContent = vi.fn().mockRejectedValue(Object.assign(new Error('invalid read'), { code: 'EINVAL' }));
    await expect(pathExists('/cgroup/run/cgroup.kill', { statPath })).resolves.toBe(true);
    expect(statPath).toHaveBeenCalledOnce();
    expect(readContent).not.toHaveBeenCalled();
  });

  it('writes one to an existing unreadable cgroup.kill control', async () => {
    const pathExistsOperation = vi.fn().mockResolvedValue(true);
    const writeControl = vi.fn().mockResolvedValue();
    await writeRequiredControl('/cgroup/run/cgroup.kill', { pathExistsOperation, writeControl });
    expect(pathExistsOperation).toHaveBeenCalledWith('/cgroup/run/cgroup.kill');
    expect(writeControl).toHaveBeenCalledWith('/cgroup/run/cgroup.kill', '1');
  });

  it('propagates a mandatory cgroup.kill write failure', async () => {
    const failure = Object.assign(new Error('write denied'), { code: 'EACCES' });
    await expect(writeRequiredControl('/cgroup/run/cgroup.kill', {
      pathExistsOperation: vi.fn().mockResolvedValue(true),
      writeControl: vi.fn().mockRejectedValue(failure),
    })).rejects.toBe(failure);
  });

  it('fails closed when cgroup.kill is absent', async () => {
    const writeControl = vi.fn();
    await expect(writeRequiredControl('/cgroup/run/cgroup.kill', {
      pathExistsOperation: vi.fn().mockResolvedValue(false),
      writeControl,
    })).rejects.toMatchObject({ code: 'CLEANUP_CGROUP_ALIVE' });
    expect(writeControl).not.toHaveBeenCalled();
  });

  it('maps only ENOENT metadata results to absent', async () => {
    await expect(pathExists('/missing', {
      statPath: vi.fn().mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' })),
    })).resolves.toBe(false);
  });

  it('propagates unexpected metadata failures and remains idempotent', async () => {
    const metadataFailure = Object.assign(new Error('metadata denied'), { code: 'EACCES' });
    await expect(pathExists('/cgroup/run/cgroup.kill', {
      statPath: vi.fn().mockRejectedValue(metadataFailure),
    })).rejects.toBe(metadataFailure);

    const writeControl = vi.fn().mockResolvedValue();
    const options = { pathExistsOperation: vi.fn().mockResolvedValue(true), writeControl };
    await writeRequiredControl('/cgroup/run/cgroup.kill', options);
    await writeRequiredControl('/cgroup/run/cgroup.kill', options);
    expect(writeControl).toHaveBeenCalledTimes(2);
  });
});
