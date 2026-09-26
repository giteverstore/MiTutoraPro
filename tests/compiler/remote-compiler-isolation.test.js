import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTAINER_LIMITS, RUNTIMES } from '../../tools/remote-compiler-runner/runtime-policy.mjs';
import { dockerExecutorInternals } from '../../tools/remote-compiler-runner/DockerExecutor.mjs';

describe('remote compiler isolation policy', () => {
  it('pins separate reviewed Go and Rust runner versions', () => {
    expect(RUNTIMES.go).toEqual(expect.objectContaining({ image: 'ycoders/go-runner:1.27.1', fileName: 'main.go' }));
    expect(RUNTIMES.rust).toEqual(expect.objectContaining({ image: 'ycoders/rust-runner:1.98.1', fileName: 'main.rs' }));
    expect(RUNTIMES.go.image).not.toBe(RUNTIMES.rust.image);
  });
  it('keeps execution resources bounded', () => {
    expect(CONTAINER_LIMITS).toEqual(expect.objectContaining({ memory: '512m', memorySwap: '512m', cpus: '1', pids: '64', tempBytes: '192m', workspaceBytes: '96m', wallTimeoutMs: 30_000, outputBytes: 1024 * 1024 }));
  });
  it('enforces the reviewed Docker isolation flags without a shell command', async () => {
    const source = await readFile(join(process.cwd(), 'tools/remote-compiler-runner/DockerExecutor.mjs'), 'utf8');
    for (const value of ["'--network', 'none'", "'--read-only'", "'--cap-drop', 'ALL'", "'no-new-privileges'", "'--memory'", "'--memory-swap'", "'--cpus'", "'--pids-limit'", "'fsize=67108864:67108864'", "'--user', '65534:65534'"]) expect(source).toContain(value);
    expect(source).toContain("runProcess(this.spawnImpl, 'docker', args"); expect(source).toContain('`/work:rw,exec,nosuid,nodev,size=${this.limits.workspaceBytes},mode=1777`'); expect(source).not.toContain("shell: true");
  });
  it('removes runner timing evidence even when a host clock adjustment makes it negative', () => {
    expect(dockerExecutorInternals.extractTimings('__YCODERS_TIMING__:run:-3\nlearner error\n')).toEqual({ output: 'learner error\n', compileTimeMs: null, runTimeMs: null });
  });
});
