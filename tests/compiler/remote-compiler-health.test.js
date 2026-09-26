import { describe, expect, it, vi } from 'vitest';
import { RunnerHealthProbe } from '../../tools/remote-compiler-runner/RunnerHealthProbe.mjs';

describe('remote compiler runner readiness', () => {
  it('requires Docker, both exact toolchains, and non-root learner identities', async () => {
    const execute = vi.fn(async (_binary, args) => {
      if (args[0] === 'version') return { stdout: '27.2.0\n' };
      if (args[0] === 'image' && args[1] === 'inspect') return { stdout: 'sha256:test\n' };
      const entrypoint = args[args.indexOf('--entrypoint') + 1];
      if (entrypoint === 'go') return { stdout: 'go version go1.27.1 linux/amd64\n' };
      if (entrypoint === 'rustc') return { stdout: 'rustc 1.98.1 (test)\n' };
      if (entrypoint === 'id') return { stdout: '65534\n' };
      throw new Error(`Unexpected probe: ${args.join(' ')}`);
    });
    await expect(new RunnerHealthProbe({ execute }).readiness()).resolves.toEqual(expect.objectContaining({ ready: true, status: 'ready', engine: '27.2.0', learnerUid: { go: 65534, rust: 65534 } }));
  });

  it('fails closed when Docker or an image cannot be inspected', async () => {
    const probe = new RunnerHealthProbe({ execute: vi.fn().mockRejectedValue(new Error('docker unavailable')) });
    await expect(probe.readiness()).resolves.toEqual({ ready: false, status: 'not_ready', runnerVersion: '1' });
  });
});
