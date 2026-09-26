import { describe, expect, it, vi } from 'vitest';
import { csharpLanguage } from '../../src/compiler/languages/csharp.js';
import { visualBasicLanguage } from '../../src/compiler/languages/visualbasic.js';
import { DotNetRuntime } from '../../src/compiler/runtimes/dotnet/DotNetRuntime.js';
import { DotNetWorkerClient } from '../../src/compiler/runtimes/dotnet/DotNetWorkerClient.js';
import { normalizeDotNetResult } from '../../src/compiler/runtimes/dotnet/normalizeDotNetResult.js';

class FakeWorker {
  listeners = new Map();
  terminate = vi.fn();
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  removeEventListener(type, callback) { if (this.listeners.get(type) === callback) this.listeners.delete(type); }
  postMessage = vi.fn((message) => {
    this.lastMessage = message;
    if (this.autoRespond) queueMicrotask(() => {
      this.listeners.get('message')?.({ data: { id: message.id, type: 'initialized', timeoutMs: message.timeoutMs } });
      this.listeners.get('message')?.({ data: { id: message.id, status: 'success', stdout: 'ok\n', diagnostics: [], exitCode: 0 } });
    });
  });
}

describe('shared .NET browser runtime', () => {
  it('registers canonical terminal and Monaco metadata', () => {
    expect(csharpLanguage).toEqual(expect.objectContaining({
      id: 'csharp', label: 'C#', monacoLanguage: 'csharp', defaultFileName: 'Program.cs', executionMode: 'terminal',
    }));
    expect(csharpLanguage.defaultSource).toContain('static void Main()');
  });

  it('registers Visual Basic as a conventional VB.NET terminal language', () => {
    expect(visualBasicLanguage).toEqual(expect.objectContaining({
      id: 'visualbasic', label: 'Visual Basic', monacoLanguage: 'vb',
      defaultFileName: 'Program.vb', executionMode: 'terminal',
    }));
    expect(visualBasicLanguage.defaultSource).toContain('Module Program');
    expect(visualBasicLanguage.defaultSource).toContain('Console.WriteLine("Hello, World!")');
  });

  it('normalizes compile diagnostics independently from runtime errors', () => {
    const result = normalizeDotNetResult({
      status: 'error', phase: 'compile', stdout: '', stderr: '', exitCode: null,
      diagnostics: [
        { code: 'CS1002', severity: 'error', line: 1, column: 27, message: '; expected' },
        { code: 'CS0219', severity: 'warning', line: 2, column: 5, message: 'assigned but never used' },
      ],
    });
    expect(result).toEqual(expect.objectContaining({ status: 'error', phase: 'compile', exitCode: null }));
    expect(result.errors[0]).toContain('CS1002 (1,27)');
    expect(result.warnings).toHaveLength(1);
    expect(result.runtimeError).toBeNull();
  });

  it('preserves stdout, stderr, runtime exceptions and honest exit evidence', () => {
    expect(normalizeDotNetResult({
      status: 'error', phase: 'runtime', stdout: 'before\n', stderr: 'problem\n',
      runtimeError: 'DivideByZeroException: Attempted to divide by zero.', diagnostics: [], exitCode: null,
    })).toEqual(expect.objectContaining({
      output: 'before', stdout: 'before', stderr: 'problem', phase: 'runtime', exitCode: null,
      runtimeError: 'DivideByZeroException: Attempted to divide by zero.',
    }));
  });

  it('preserves genuine Visual Basic diagnostics and language metadata', () => {
    const result = normalizeDotNetResult({
      status: 'error', phase: 'compile', stdout: '', stderr: '', exitCode: null,
      diagnostics: [{ code: 'BC30035', severity: 'error', line: 4, column: 1, message: 'Syntax error.' }],
    }, 'visualbasic');
    expect(result.errors).toEqual(['BC30035 (4,1): Syntax error.']);
    expect(result.dotnet).toEqual(expect.objectContaining({
      language: 'visualbasic', languageVersion: '16.9', compilerVersion: '5.9.0',
    }));
  });

  it('preserves a managed Main return code as a runtime failure', () => {
    expect(normalizeDotNetResult({
      status: 'success', phase: 'runtime', stdout: '', stderr: '', diagnostics: [], exitCode: 7,
    })).toEqual(expect.objectContaining({
      status: 'error', phase: 'runtime', exitCode: 7, errors: ['Program exited with code 7.'],
    }));
  });

  it('uses a fresh disposable worker for every successful run', async () => {
    const first = new FakeWorker(); first.autoRespond = true;
    const second = new FakeWorker(); second.autoRespond = true;
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const client = new DotNetWorkerClient({ workerFactory: factory });
    await client.execute({ language: 'csharp', source: 'Console.WriteLine(1);' });
    await client.execute({ language: 'csharp', source: 'Console.WriteLine(2);' });
    expect(factory).toHaveBeenCalledTimes(2);
    expect(first.terminate).toHaveBeenCalledOnce();
    expect(second.terminate).toHaveBeenCalledOnce();
  });

  it('terminates runaway work and recovers with a clean worker', async () => {
    const stuck = new FakeWorker();
    const recovered = new FakeWorker(); recovered.autoRespond = true;
    const client = new DotNetWorkerClient({ timeoutMs: 5, initializationTimeoutMs: 0, workerFactory: vi.fn().mockReturnValueOnce(stuck).mockReturnValueOnce(recovered) });
    await expect(client.execute({ language: 'csharp', source: 'while (true) {}' })).rejects.toThrow('exceeded 5 ms');
    expect(stuck.terminate).toHaveBeenCalledOnce();
    await expect(client.execute({ language: 'csharp', source: 'Console.WriteLine("recovered");' })).resolves.toEqual(expect.objectContaining({ stdout: 'ok\n' }));
  });

  it('cleans workers on cancel, reset, and disposal', async () => {
    const worker = new FakeWorker();
    const client = new DotNetWorkerClient({ workerFactory: () => worker });
    const controller = new AbortController();
    const execution = client.execute({ language: 'csharp', source: 'while (true) {}', signal: controller.signal });
    controller.abort();
    await expect(execution).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).toHaveBeenCalledOnce();
    client.reset();
    client.dispose();
  });

  it('keeps the lowest runtime layer reusable for future .NET language adapters', async () => {
    const client = { initialize: vi.fn(), execute: vi.fn().mockResolvedValue({ status: 'success', stdout: 'Hello\n', diagnostics: [], exitCode: 0 }), reset: vi.fn(), dispose: vi.fn() };
    const runtime = new DotNetRuntime({ language: 'csharp', client });
    await expect(runtime.execute({ source: 'Console.WriteLine("Hello");' })).resolves.toEqual(expect.objectContaining({ status: 'success', output: 'Hello' }));
    expect(client.execute).toHaveBeenCalledWith(expect.objectContaining({ language: 'csharp' }));
  });

  it('routes Visual Basic through the same runtime and worker client', async () => {
    const client = { initialize: vi.fn(), execute: vi.fn().mockResolvedValue({ status: 'success', stdout: 'Hello\n', diagnostics: [], exitCode: 0 }), reset: vi.fn(), dispose: vi.fn() };
    const runtime = new DotNetRuntime({ language: 'visualbasic', client });
    await expect(runtime.execute({ source: 'Console.WriteLine("Hello")' })).resolves.toEqual(expect.objectContaining({
      status: 'success', output: 'Hello', dotnet: expect.objectContaining({ language: 'visualbasic' }),
    }));
    expect(client.execute).toHaveBeenCalledWith(expect.objectContaining({ language: 'visualbasic' }));
  });

  it('isolates C# and Visual Basic in fresh workers across language changes', async () => {
    const csharpWorker = new FakeWorker(); csharpWorker.autoRespond = true;
    const vbWorker = new FakeWorker(); vbWorker.autoRespond = true;
    const recoveredCsharpWorker = new FakeWorker(); recoveredCsharpWorker.autoRespond = true;
    const factory = vi.fn()
      .mockReturnValueOnce(csharpWorker)
      .mockReturnValueOnce(vbWorker)
      .mockReturnValueOnce(recoveredCsharpWorker);
    const client = new DotNetWorkerClient({ workerFactory: factory });
    await client.execute({ language: 'csharp', source: 'Console.WriteLine(1);' });
    await client.execute({ language: 'visualbasic', source: 'Console.WriteLine(2)' });
    await client.execute({ language: 'csharp', source: 'Console.WriteLine(3);' });
    expect(factory).toHaveBeenCalledTimes(3);
    expect([csharpWorker, vbWorker, recoveredCsharpWorker].every((worker) => worker.terminate.mock.calls.length === 1)).toBe(true);
  });

  it('uses a Visual Basic-specific timeout message and recovers in C#', async () => {
    const stuck = new FakeWorker();
    const recovered = new FakeWorker(); recovered.autoRespond = true;
    const client = new DotNetWorkerClient({ timeoutMs: 5, initializationTimeoutMs: 0, workerFactory: vi.fn().mockReturnValueOnce(stuck).mockReturnValueOnce(recovered) });
    await expect(client.execute({ language: 'visualbasic', source: 'While True\nEnd While' })).rejects.toThrow('Visual Basic execution exceeded 5 ms');
    await expect(client.execute({ language: 'csharp', source: 'Console.WriteLine("recovered");' })).resolves.toEqual(expect.objectContaining({ stdout: 'ok\n' }));
  });
});
