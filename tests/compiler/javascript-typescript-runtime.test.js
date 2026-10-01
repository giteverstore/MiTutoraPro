import { describe, expect, it, vi } from 'vitest';
import { executeJavaScriptSource } from '../../src/compiler/runtimes/javascript/javascriptExecution.js';
import { JavaScriptWorkerClient } from '../../src/compiler/runtimes/javascript/JavaScriptWorkerClient.js';
import { JavaScriptRuntime } from '../../src/compiler/runtimes/javascript/JavaScriptRuntime.js';
import { TypeScriptRuntime } from '../../src/compiler/runtimes/typescript/TypeScriptRuntime.js';

describe('JavaScript and TypeScript browser runtimes', () => {
  it('stops worker-side output capture at the shared stdout limit', async () => {
    const result = await executeJavaScriptSource({ source: 'console.log("x".repeat(2 * 1024 * 1024 + 1));' });
    expect(result).toMatchObject({ status: 'error', code: 'output_limit_exceeded', truncated: true });
    expect(result.errors).toContain('Program stopped because it produced too much output.');
    expect(new TextEncoder().encode(result.stdout).byteLength).toBeLessThanOrEqual(2 * 1024 * 1024);
  });

  it('rejects dynamic imports before module resolution can initiate a request', async () => {
    const result = await executeJavaScriptSource({ source: "return import('https://example.invalid/probe.js');" });

    expect(result.status).toBe('error');
    expect(result.stderr).toContain('Network access is unavailable in this compiler.');
  });

  it('requests and submits interactive input through the shared channel', async () => {
    const originalIsolation = globalThis.crossOriginIsolated;
    Object.defineProperty(globalThis, 'crossOriginIsolated', { configurable: true, value: true });
    class FakeWorker extends EventTarget {
      messages = [];
      postMessage(message) { this.messages.push(message); }
      respond(data) { this.dispatchEvent(new MessageEvent('message', { data })); }
      terminate() { this.terminated = true; }
    }
    const worker = new FakeWorker();
    const events = [];
    const client = new JavaScriptWorkerClient({ workerFactory: () => worker });
    const pending = client.execute({ source: 'console.log(readLine())', executionId: 'js-1', onExecutionEvent: (event) => events.push(event) });
    const request = worker.messages[0];
    const control = new Int32Array(request.controlBuffer);
    Atomics.store(control, 0, 1);
    worker.respond({ id: request.id, type: 'stdin-request' });
    expect(client.submitStdin({ executionId: 'stale', value: 'no\n' })).toBe(false);
    expect(client.submitStdin({ executionId: 'js-1', value: 'yes\n' })).toBe(true);
    worker.respond({ id: request.id, type: 'stdout', value: 'yes\n' });
    worker.respond({ id: request.id, type: 'execution', status: 'success', stdout: 'yes', stderr: '', executionTimeMs: 1 });
    await expect(pending).resolves.toMatchObject({ stdout: 'yes' });
    expect(events.map(({ type }) => type)).toEqual(['execution-start', 'stdin-request', 'stdout', 'execution-complete']);
    Object.defineProperty(globalThis, 'crossOriginIsolated', { configurable: true, value: originalIsolation });
  });
  it.each([
    ['console.log("Hello");', 'Hello'],
    ['console.log(5 + 5);', '10'],
    ['console.log("one"); console.info("two");', 'one\ntwo'],
    ['console.log(Number(readLine()) * 2);', '10'],
  ])('executes JavaScript with isolated output capture', async (source, output) => {
    const result = await executeJavaScriptSource({ source, stdin: '5' });
    expect(result).toEqual(expect.objectContaining({ status: 'success', stdout: output, stderr: '' }));
  });

  it.each([
    ['console.log(missingValue);', 'ReferenceError'],
    ['const = 1;', 'SyntaxError'],
    ['throw new Error("intentional");', 'intentional'],
  ])('normalizes JavaScript failures without escaping the runtime', async (source, diagnostic) => {
    const result = await executeJavaScriptSource({ source });
    expect(result.status).toBe('error');
    expect(result.stderr).toContain(diagnostic);
  });

  it('captures warning and error output on stderr', async () => {
    const result = await executeJavaScriptSource({ source: 'console.warn("careful"); console.error("failed");' });
    expect(result).toEqual(expect.objectContaining({ status: 'success', stdout: '', stderr: 'careful\nfailed' }));
  });

  it('terminates a timed-out worker and permits a clean second execution', async () => {
    const workers = [];
    class FakeWorker {
      constructor(respond) { this.respond = respond; this.listeners = {}; this.terminate = vi.fn(); workers.push(this); }
      addEventListener(type, callback) { this.listeners[type] = callback; }
      postMessage(message) {
        if (this.respond) queueMicrotask(() => this.listeners.message({ data: { id: message.id, status: 'success', stdout: 'recovered', stderr: '', executionTimeMs: 1 } }));
      }
    }
    let attempt = 0;
    const client = new JavaScriptWorkerClient({ timeoutMs: 5, workerFactory: () => new FakeWorker(++attempt > 1) });
    await expect(client.execute({ source: 'while (true) {}' })).rejects.toThrow('exceeded 5 ms');
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    await expect(client.execute({ source: 'console.log("recovered")' })).resolves.toEqual(expect.objectContaining({ stdout: 'recovered' }));
    expect(workers[1].terminate).toHaveBeenCalledOnce();
  });

  it('normalizes the worker payload through the canonical runtime result contract', async () => {
    const runtime = new JavaScriptRuntime({ client: { initialize: vi.fn(), execute: vi.fn().mockResolvedValue({ status: 'success', stdout: '42\n', stderr: '', executionTimeMs: 3 }), reset: vi.fn(), dispose: vi.fn() } });
    await expect(runtime.execute({ source: 'console.log(42)' })).resolves.toEqual({ status: 'success', output: '42', errors: [], executionTimeMs: 3 });
  });

  it('transpiles TypeScript and delegates execution to the JavaScript runtime', async () => {
    const javascriptRuntime = { initialize: vi.fn(), execute: vi.fn().mockResolvedValue({ status: 'success', output: '20', errors: [], executionTimeMs: 2 }), reset: vi.fn(), dispose: vi.fn() };
    const runtime = new TypeScriptRuntime({ javascriptRuntime });
    const result = await runtime.execute({ source: 'const x: number = 10; console.log(x * 2);', filename: 'main.ts' });
    expect(result.output).toBe('20');
    expect(javascriptRuntime.execute).toHaveBeenCalledWith(expect.objectContaining({
      filename: 'main.js',
      source: expect.not.stringContaining(': number'),
    }));
  });

  it('executes transpiled TypeScript through the JavaScript engine and preserves runtime failures', async () => {
    const javascriptRuntime = new JavaScriptRuntime({
      client: {
        initialize: vi.fn(),
        execute: executeJavaScriptSource,
        reset: vi.fn(),
        dispose: vi.fn(),
      },
    });
    const runtime = new TypeScriptRuntime({ javascriptRuntime });
    await expect(runtime.execute({ source: 'const x: number = 10; console.log(x * 2);', filename: 'main.ts' }))
      .resolves.toEqual(expect.objectContaining({ status: 'success', output: '20' }));
    const failed = await runtime.execute({ source: 'const value: string = missingValue; console.log(value);', filename: 'main.ts' });
    expect(failed.status).toBe('error');
    expect(failed.errors.join('\n')).toContain('ReferenceError');
  });

  it('returns TypeScript transpilation diagnostics before JavaScript execution', async () => {
    const javascriptRuntime = { initialize: vi.fn(), execute: vi.fn(), reset: vi.fn(), dispose: vi.fn() };
    const runtime = new TypeScriptRuntime({ javascriptRuntime });
    const result = await runtime.execute({ source: 'const value: = 10;', filename: 'main.ts' });
    expect(result.status).toBe('error');
    expect(result.errors.join('\n')).toContain('main.ts');
    expect(javascriptRuntime.execute).not.toHaveBeenCalled();
  });
});
