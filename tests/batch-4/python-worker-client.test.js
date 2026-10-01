import { describe, expect, it, vi } from 'vitest';
import { PythonWorkerClient } from '../../src/compiler/runtimes/python/PythonWorkerClient';

class FakeWorker extends EventTarget {
  constructor(onPost) {
    super();
    this.onPost = onPost;
    this.terminated = false;
  }

  postMessage(message) { this.onPost?.(message, this); }
  respond(data) { this.dispatchEvent(new MessageEvent('message', { data })); }
  terminate() { this.terminated = true; }
}

describe('PythonWorkerClient lifecycle', () => {
  it('initializes and captures execution payloads', async () => {
    const worker = new FakeWorker((message, target) => {
      queueMicrotask(() => target.respond(message.type === 'initialize'
        ? { id: message.id, type: 'initialized' }
        : { id: message.id, type: 'execution', status: 'success', stdout: 'out\n', stderr: 'warn\n', executionTimeMs: 4 }));
    });
    const client = new PythonWorkerClient({ workerFactory: () => worker });
    await client.initialize();
    await expect(client.execute({ source: 'print(input())', stdin: 'hello' })).resolves.toMatchObject({
      stdout: 'out\n',
      stderr: 'warn\n',
      executionTimeMs: 4,
    });
    expect(worker.terminated).toBe(true);
    expect(client.worker).toBeNull();
  });

  it('reuses initialization only within one execution and recreates a clean worker afterward', async () => {
    const workers = [];
    const client = new PythonWorkerClient({ workerFactory: () => {
      const worker = new FakeWorker((message, target) => queueMicrotask(() => target.respond(
        message.type === 'initialize'
          ? { id: message.id, type: 'initialized' }
          : { id: message.id, type: 'execution', status: 'success', stdout: '', stderr: '', executionTimeMs: 1 },
      )));
      workers.push(worker);
      return worker;
    } });

    await client.initialize();
    await client.initialize();
    expect(workers).toHaveLength(1);
    await client.execute({ source: 'x = 123' });
    expect(workers[0].terminated).toBe(true);
    await client.initialize();
    expect(workers).toHaveLength(2);
  });

  it('terminates on timeout and recreates a worker for the next request', async () => {
    const workers = [];
    const client = new PythonWorkerClient({
      executionTimeoutMs: 5,
      workerFactory: () => {
        const worker = new FakeWorker();
        workers.push(worker);
        return worker;
      },
    });
    await expect(client.execute({ source: 'while True: pass' })).rejects.toThrow('exceeded 5 ms');
    expect(workers[0].terminated).toBe(true);
    const next = client.execute({ source: 'print(1)' });
    await vi.waitFor(() => expect(workers).toHaveLength(2));
    workers[1].respond({ id: 2, type: 'execution', status: 'success', stdout: '1\n', stderr: '', executionTimeMs: 1 });
    await expect(next).resolves.toMatchObject({ stdout: '1\n' });
  });

  it('terminates on cancellation and can initialize again', async () => {
    const workers = [];
    const client = new PythonWorkerClient({ workerFactory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    } });
    const controller = new AbortController();
    const pending = client.execute({ source: 'long()', signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers[0].terminated).toBe(true);
    const initialized = client.initialize();
    workers[1].respond({ id: 2, type: 'initialized' });
    await expect(initialized).resolves.toMatchObject({ type: 'initialized' });
  });

  it('ignores late messages from a cancelled execution after a new worker starts', async () => {
    const workers = [];
    const client = new PythonWorkerClient({ workerFactory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    } });
    const controller = new AbortController();
    const first = client.execute({ source: 'input()', executionId: 'run-a', signal: controller.signal });
    controller.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });

    const second = client.execute({ source: 'print("B")', executionId: 'run-b' });
    workers[0].respond({ id: 1, type: 'execution', status: 'success', stdout: 'late A\n', stderr: '', executionTimeMs: 1 });
    workers[1].respond({ id: 2, type: 'execution', status: 'success', stdout: 'B\n', stderr: '', executionTimeMs: 1 });
    await expect(second).resolves.toMatchObject({ stdout: 'B\n' });
  });
});
