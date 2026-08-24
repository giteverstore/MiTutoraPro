import { describe, expect, it, vi } from 'vitest';
import { CompilerManager } from '../../src/compiler/core/CompilerManager';
import { RuntimeRegistry } from '../../src/compiler/core/RuntimeRegistry';
import { ValidatorRegistry } from '../../src/compiler/core/ValidatorRegistry';
import { NormalizedOutputValidator } from '../../src/compiler/validators/NormalizedOutputValidator';
import { COMPILER_EVENTS, dispatchCompilerRun } from '../../src/compiler/core/compilerEvents';

function createManager(factory) {
  return new CompilerManager({
    runtimeRegistry: new RuntimeRegistry().register('python', factory).register('java', factory),
    validatorRegistry: new ValidatorRegistry().register('normalized', new NormalizedOutputValidator()),
  });
}

describe('compiler instance isolation', () => {
  it('targets run events to one explicit compiler instance', () => {
    const listener = vi.fn();
    window.addEventListener(COMPILER_EVENTS.run, listener);
    dispatchCompilerRun('practice-question-a');
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail).toEqual({
      instanceId: 'practice-question-a',
      source: 'keyboard',
    });
    window.removeEventListener(COMPILER_EVENTS.run, listener);
  });

  it('uses independent runtime instances for simultaneous panels and languages', async () => {
    let runtimeNumber = 0;
    const manager = createManager(() => {
      const id = ++runtimeNumber;
      return {
        initialize: vi.fn(async () => undefined),
        execute: vi.fn(async ({ source }) => ({ status: 'success', output: `${id}:${source}`, errors: [] })),
        format: vi.fn(async (source) => source),
        reset: vi.fn(async () => undefined),
        dispose: vi.fn(async () => undefined),
      };
    });
    const [a, b, java] = await Promise.all([
      manager.execute({ language: 'python', source: 'A', instanceId: 'a' }),
      manager.execute({ language: 'python', source: 'B', instanceId: 'b' }),
      manager.execute({ language: 'java', source: 'J', instanceId: 'java' }),
    ]);
    expect(new Set([a.output, b.output, java.output]).size).toBe(3);
  });

  it('cancels A without interrupting B', async () => {
    const controls = new Map();
    const manager = createManager(() => ({
      initialize: async () => undefined,
      execute: ({ source, signal }) => new Promise((resolve, reject) => {
        const abort = () => reject(new DOMException('cancelled', 'AbortError'));
        signal?.addEventListener('abort', abort, { once: true });
        controls.set(source, () => resolve({ status: 'success', output: source, errors: [] }));
      }),
      format: async (source) => source,
      reset: async () => undefined,
      dispose: async () => undefined,
    }));
    const controllerA = new AbortController();
    const controllerB = new AbortController();
    const runA = manager.execute({ language: 'python', source: 'A', instanceId: 'a', signal: controllerA.signal });
    const runB = manager.execute({ language: 'python', source: 'B', instanceId: 'b', signal: controllerB.signal });
    await vi.waitFor(() => expect(controls.size).toBe(2));
    controllerA.abort();
    controls.get('B')();
    await expect(runA).rejects.toMatchObject({ name: 'AbortError' });
    await expect(runB).resolves.toMatchObject({ output: 'B' });
  });

  it('keeps outputs scoped when B completes before A and on repeated runs', async () => {
    const controls = [];
    const manager = createManager(() => ({
      initialize: async () => undefined,
      execute: ({ source }) => new Promise((resolve) => controls.push({ source, resolve })),
      format: async (source) => source,
      reset: async () => undefined,
      dispose: async () => undefined,
    }));
    const runA = manager.execute({ language: 'python', source: 'course-a', instanceId: 'course-panel' });
    const runB = manager.execute({ language: 'python', source: 'practice-b', instanceId: 'practice-panel' });
    await vi.waitFor(() => expect(controls).toHaveLength(2));
    controls[1].resolve({ status: 'success', output: 'practice-b', errors: [] });
    controls[0].resolve({ status: 'success', output: 'course-a', errors: [] });
    await expect(runB).resolves.toMatchObject({ output: 'practice-b' });
    await expect(runA).resolves.toMatchObject({ output: 'course-a' });

    const repeated = manager.execute({ language: 'python', source: 'course-a-2', instanceId: 'course-panel' });
    await vi.waitFor(() => expect(controls).toHaveLength(3));
    controls[2].resolve({ status: 'success', output: 'course-a-2', errors: [] });
    await expect(repeated).resolves.toMatchObject({ output: 'course-a-2' });
  });
});
