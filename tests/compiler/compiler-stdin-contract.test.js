import { describe, expect, it, vi } from 'vitest';
import { CompilerManager, normalizeCompilerStdin } from '../../src/compiler/core/CompilerManager.js';

function createManager() {
  const runtime = { initialize: vi.fn().mockResolvedValue(undefined), execute: vi.fn().mockResolvedValue({ status: 'success' }) };
  const manager = new CompilerManager({
    runtimeRegistry: {
      has: () => true,
      resolve: () => runtime,
      getInitializedRuntimes: () => [],
      dispose: vi.fn(),
    },
    validatorRegistry: { resolve: vi.fn() },
  });
  return { manager, runtime };
}

describe('canonical compiler stdin contract', () => {
  it.each([
    ['25'],
    ['10\n20'],
    ['one\n\ntwo'],
    ['hello world'],
    [' trailing spaces  \n'],
    ['ನಮಸ್ಕಾರ\nこんにちは\nAvi 🚀'],
  ])('preserves exact string stdin: %j', async (stdin) => {
    const { manager, runtime } = createManager();
    await manager.execute({ language: 'python', source: 'print(input())', stdin });
    expect(runtime.execute).toHaveBeenCalledWith(expect.objectContaining({ stdin }));
  });

  it('normalizes absent stdin to an empty string and keeps legacy arrays at the shared boundary', async () => {
    expect(normalizeCompilerStdin(undefined)).toBe('');
    expect(normalizeCompilerStdin(['one', '', 'two'])).toBe('one\n\ntwo');
    const { manager, runtime } = createManager();
    await manager.execute({ language: 'python', source: 'pass' });
    expect(runtime.execute).toHaveBeenCalledWith(expect.objectContaining({ stdin: '' }));
  });
});
