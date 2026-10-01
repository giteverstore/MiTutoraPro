import { describe, expect, it, vi } from 'vitest';
import { CompilerManager } from '../../src/compiler/core/CompilerManager.js';
import {
  appendBoundedTranscript,
  COMPILER_RESOURCE_LIMITS,
  utf8ByteLength,
} from '../../src/compiler/core/compilerResourcePolicy.js';

function managerWith(runtime) {
  return new CompilerManager({
    runtimeRegistry: {
      has: () => true,
      resolve: () => runtime,
      getInitializedRuntimes: () => [],
      dispose: vi.fn(),
    },
    validatorRegistry: { resolve: vi.fn() },
  });
}

const success = { status: 'success', output: '', stdout: '', stderr: '', errors: [], executionTimeMs: 1 };

describe('compiler resource policy', () => {
  it.each([
    ['source', 'a', COMPILER_RESOURCE_LIMITS.sourceBytes],
    ['Unicode source', 'é', COMPILER_RESOURCE_LIMITS.sourceBytes / 2],
  ])('accepts %s at the exact UTF-8 boundary and rejects one byte beyond it', async (_name, unit, count) => {
    const runtime = { initialize: vi.fn().mockResolvedValue(undefined), execute: vi.fn().mockResolvedValue(success) };
    const manager = managerWith(runtime);
    const exact = unit.repeat(count);
    await expect(manager.execute({ language: 'python', source: exact.slice(0, -1) })).resolves.toMatchObject({ status: 'success' });
    await expect(manager.execute({ language: 'python', source: exact })).resolves.toMatchObject({ status: 'success' });
    const over = `${exact}x`;
    await expect(manager.execute({ language: 'python', source: over })).resolves.toMatchObject({ code: 'source_limit_exceeded' });
    expect(runtime.execute).toHaveBeenCalledTimes(2);
  });

  it('checks buffered stdin in UTF-8 bytes before runtime initialization', async () => {
    const runtime = { initialize: vi.fn().mockResolvedValue(undefined), execute: vi.fn().mockResolvedValue(success) };
    const manager = managerWith(runtime);
    const exact = 'é'.repeat(COMPILER_RESOURCE_LIMITS.bufferedStdinBytes / 2);
    await expect(manager.execute({ language: 'python', source: '', stdin: exact.slice(0, -1) })).resolves.toMatchObject({ status: 'success' });
    await expect(manager.execute({ language: 'python', source: '', stdin: exact })).resolves.toMatchObject({ status: 'success' });
    await expect(manager.execute({ language: 'python', source: '', stdin: `${exact}x` })).resolves.toMatchObject({ code: 'stdin_limit_exceeded' });
    expect(runtime.execute).toHaveBeenCalledTimes(2);
  });

  it('keeps stderr independent and aborts when its smaller budget is crossed', async () => {
    const runtime = {
      initialize: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn(({ signal, onExecutionEvent }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
        onExecutionEvent({ type: 'stderr', executionId: 'run', value: 'x'.repeat(COMPILER_RESOURCE_LIMITS.stderrBytes + 1) });
        resolve(success);
      })),
    };
    const manager = managerWith(runtime);
    await expect(manager.execute({ language: 'javascript', source: '', instanceId: 'one', executionId: 'run', onExecutionEvent: vi.fn() }))
      .resolves.toMatchObject({ status: 'error', code: 'stderr_limit_exceeded', truncated: true });
  });

  it('aborts streaming execution when stdout crosses its independent budget', async () => {
    const runtime = {
      initialize: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn(({ signal, onExecutionEvent }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
        onExecutionEvent({ type: 'stdout', executionId: 'run', value: 'x'.repeat(COMPILER_RESOURCE_LIMITS.stdoutBytes) });
        onExecutionEvent({ type: 'stdout', executionId: 'run', value: 'x' });
        resolve(success);
      })),
    };
    const manager = managerWith(runtime);
    await expect(manager.execute({ language: 'javascript', source: '', instanceId: 'one', executionId: 'run', onExecutionEvent: vi.fn() }))
      .resolves.toMatchObject({ status: 'error', code: 'output_limit_exceeded', truncated: true });
  });

  it('rejects oversized interactive submissions and aborts after the cumulative allowance', async () => {
    let release;
    const runtime = {
      initialize: vi.fn().mockResolvedValue(undefined),
      submitStdin: vi.fn(() => true),
      execute: vi.fn(({ signal }) => new Promise((resolve, reject) => {
        release = resolve;
        signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
      })),
    };
    const manager = managerWith(runtime);
    const run = manager.execute({ language: 'python', source: '', instanceId: 'one', executionId: 'run' });
    await vi.waitFor(() => expect(runtime.execute).toHaveBeenCalled());
    expect(() => manager.submitStdin({ language: 'python', instanceId: 'one', executionId: 'run', value: 'x'.repeat(COMPILER_RESOURCE_LIMITS.interactiveStdinSubmissionBytes + 1) }))
      .toThrow(expect.objectContaining({ code: 'stdin_limit_exceeded' }));
    const chunk = 'x'.repeat(COMPILER_RESOURCE_LIMITS.interactiveStdinSubmissionBytes);
    for (let used = 0; used < COMPILER_RESOURCE_LIMITS.interactiveStdinExecutionBytes; used += chunk.length) {
      expect(manager.submitStdin({ language: 'python', instanceId: 'one', executionId: 'run', value: chunk })).toBe(true);
    }
    expect(() => manager.submitStdin({ language: 'python', instanceId: 'one', executionId: 'run', value: 'x' }))
      .toThrow(expect.objectContaining({ code: 'stdin_limit_exceeded' }));
    await expect(run).resolves.toMatchObject({ code: 'stdin_limit_exceeded' });
    release?.(success);
  });

  it('keeps the newest transcript, stays byte-bounded, and inserts one marker', () => {
    let transcript = { text: '', bytes: 0, truncated: false };
    transcript = appendBoundedTranscript(transcript, 'old\n', 64);
    transcript = appendBoundedTranscript(transcript, 'é'.repeat(40), 64);
    transcript = appendBoundedTranscript(transcript, '\nnewest', 64);
    expect(utf8ByteLength(transcript.text)).toBeLessThanOrEqual(64);
    expect(transcript.text).toContain('[Earlier terminal output truncated]');
    expect(transcript.text.match(/Earlier terminal output truncated/g)).toHaveLength(1);
    expect(transcript.text).toContain('newest');
  });
});
