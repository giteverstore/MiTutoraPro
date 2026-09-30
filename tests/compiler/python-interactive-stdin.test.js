import { afterEach, describe, expect, it, vi } from 'vitest';
import { PythonWorkerClient } from '../../src/compiler/runtimes/python/PythonWorkerClient.js';

class FakeWorker extends EventTarget {
  messages = [];
  postMessage(message) { this.messages.push(message); }
  respond(data) { this.dispatchEvent(new MessageEvent('message', { data })); }
  terminate() { this.terminated = true; }
}

const originalIsolation = globalThis.crossOriginIsolated;
afterEach(() => { Object.defineProperty(globalThis, 'crossOriginIsolated', { configurable: true, value: originalIsolation }); });

describe('Python interactive stdin protocol', () => {
  it('associates requests and submissions with the active execution only', async () => {
    Object.defineProperty(globalThis, 'crossOriginIsolated', { configurable: true, value: true });
    const worker = new FakeWorker();
    const events = [];
    const client = new PythonWorkerClient({ workerFactory: () => worker, executionTimeoutMs: 1_000 });
    const pending = client.execute({ source: 'print(input())', executionId: 'run-1', onExecutionEvent: (event) => events.push(event) });
    const request = worker.messages[0];
    const control = new Int32Array(request.controlBuffer);
    Atomics.store(control, 0, 1);
    worker.respond({ id: request.id, type: 'stdout', value: 'Prompt: ' });
    worker.respond({ id: request.id, type: 'stdin-request' });
    expect(client.submitStdin({ executionId: 'stale-run', value: 'wrong\n' })).toBe(false);
    expect(client.submitStdin({ executionId: 'run-1', value: '42\n' })).toBe(true);
    expect(new TextDecoder().decode(new Uint8Array(request.inputBuffer).slice(0, Atomics.load(control, 1)))).toBe('42\n');
    worker.respond({ id: request.id, type: 'execution', status: 'success', stdout: 'Prompt: 42\n', stderr: '', executionTimeMs: 2 });
    await expect(pending).resolves.toMatchObject({ stdout: 'Prompt: 42\n' });
    expect(events.map(({ type }) => type)).toEqual(['execution-start', 'stdout', 'stdin-request', 'execution-complete']);
  });

  it('terminates a worker waiting for input when cancelled', async () => {
    Object.defineProperty(globalThis, 'crossOriginIsolated', { configurable: true, value: true });
    const worker = new FakeWorker();
    const controller = new AbortController();
    const client = new PythonWorkerClient({ workerFactory: () => worker });
    const pending = client.execute({ source: 'input()', executionId: 'run-cancel', onExecutionEvent: vi.fn(), signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminated).toBe(true);
    expect(client.submitStdin({ executionId: 'run-cancel', value: 'late\n' })).toBe(false);
  });

  it('does not silently degrade an unavailable interactive channel into EOF', async () => {
    Object.defineProperty(globalThis, 'crossOriginIsolated', { configurable: true, value: false });
    const worker = new FakeWorker();
    const client = new PythonWorkerClient({ workerFactory: () => worker });
    const pending = client.execute({ source: 'input()', executionId: 'run-no-isolation', onExecutionEvent: vi.fn() });
    const request = worker.messages[0];
    expect(request.interactive).toBe(false);
    worker.respond({ id: request.id, type: 'execution', status: 'error', stdout: '', stderr: 'EOFError: EOF when reading a line', executionTimeMs: 1 });
    await expect(pending).resolves.toMatchObject({
      status: 'error',
      stderr: 'Interactive input is unavailable in this browser session. Enter standard input before running your program.',
    });
  });
});
