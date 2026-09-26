import { describe, expect, it, vi } from 'vitest';
import { phpLanguage } from '../../src/compiler/languages/php.js';
import { PhpRuntime } from '../../src/compiler/runtimes/php/PhpRuntime.js';
import { PhpWorkerClient } from '../../src/compiler/runtimes/php/PhpWorkerClient.js';
import { createPhpExecutionResult } from '../../src/compiler/runtimes/php/outputCapture.js';

class FakeWorker {
  constructor({ response } = {}) {
    this.response = response;
    this.listeners = new Map();
    this.terminate = vi.fn();
  }

  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }

  postMessage(message) {
    this.message = message;
    if (this.response) {
      queueMicrotask(() => this.listeners.get('message')?.({ data: this.response }));
    }
  }
}

describe('PHP browser runtime', () => {
  it('registers canonical terminal and Monaco metadata', () => {
    expect(phpLanguage).toEqual(expect.objectContaining({
      id: 'php',
      label: 'PHP',
      monacoLanguage: 'php',
      defaultFileName: 'main.php',
      executionMode: 'terminal',
    }));
    expect(phpLanguage.defaultSource).toContain('<?php');
  });

  it('passes source, filename, and multiline stdin to a disposable worker', async () => {
    const worker = new FakeWorker({
      response: { status: 'success', stdout: '10\n', stderr: '', exitCode: 0, executionTimeMs: 4 },
    });
    const client = new PhpWorkerClient({ workerFactory: () => worker });
    await expect(client.execute({
      source: '<?php echo trim(fgets(STDIN));',
      stdin: ['5', '10'],
      filename: 'main.php',
    })).resolves.toEqual(expect.objectContaining({ stdout: '10\n' }));
    expect(worker.message).toEqual(expect.objectContaining({
      type: 'execute',
      stdin: '5\n10',
      filename: 'main.php',
    }));
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('normalizes stdout, stderr, exit code, and execution time', () => {
    expect(createPhpExecutionResult({
      status: 'error',
      stdout: 'partial\n',
      stderr: 'PHP Fatal error: failure\n',
      exitCode: 255,
      executionTimeMs: 8,
    })).toEqual({
      status: 'error',
      output: 'partial',
      errors: ['PHP Fatal error: failure'],
      stdout: 'partial',
      stderr: 'PHP Fatal error: failure',
      exitCode: 255,
      executionTimeMs: 8,
    });
  });

  it('terminates a timed-out worker and permits a clean rerun', async () => {
    const first = new FakeWorker();
    const second = new FakeWorker({
      response: { status: 'success', stdout: 'recovered', stderr: '', exitCode: 0, executionTimeMs: 1 },
    });
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const client = new PhpWorkerClient({ timeoutMs: 5, workerFactory: factory });

    await expect(client.execute({ source: '<?php while (true) {}' })).rejects.toThrow('exceeded 5 ms');
    expect(first.terminate).toHaveBeenCalledOnce();
    await expect(client.execute({ source: '<?php echo "recovered";' })).resolves.toEqual(
      expect.objectContaining({ stdout: 'recovered' }),
    );
    expect(second.terminate).toHaveBeenCalledOnce();
  });

  it('terminates workers on cancel, reset, and disposal', async () => {
    const worker = new FakeWorker();
    const client = new PhpWorkerClient({ workerFactory: () => worker });
    const controller = new AbortController();
    const execution = client.execute({ source: '<?php while (true) {}', signal: controller.signal });
    controller.abort();
    await expect(execution).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).toHaveBeenCalledOnce();
    client.reset();
    client.dispose();
  });

  it('uses the shared RuntimeAdapter result contract', async () => {
    const client = {
      initialize: vi.fn(),
      execute: vi.fn().mockResolvedValue({
        status: 'success', stdout: '30\n', stderr: '', exitCode: 0, executionTimeMs: 2,
      }),
      reset: vi.fn(),
      dispose: vi.fn(),
    };
    const runtime = new PhpRuntime({ client });
    await expect(runtime.execute({ source: '<?php echo 10 + 20;' })).resolves.toEqual(
      expect.objectContaining({ status: 'success', output: '30', exitCode: 0 }),
    );
  });
});
