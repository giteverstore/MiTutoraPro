import { describe, expect, it, vi } from 'vitest';
import { rLanguage } from '../../src/compiler/languages/r.js';
import { RRuntime } from '../../src/compiler/runtimes/r/RRuntime.js';
import { WebRClient } from '../../src/compiler/runtimes/r/WebRClient.js';
import { createRExecutionResult } from '../../src/compiler/runtimes/r/outputCapture.js';

function createFakeWebR({ captured, pending = false } = {}) {
  const instance = {
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
    writeConsole: vi.fn(),
    FS: { writeFile: vi.fn().mockResolvedValue(undefined) },
    evalRVoid: vi.fn().mockResolvedValue(undefined),
    globalShelter: {
      captureR: vi.fn(() => pending ? new Promise(() => {}) : Promise.resolve(captured ?? {
        output: [{ type: 'stdout', data: '[1] "Hello"' }], images: [], result: {},
      })),
    },
  };
  return instance;
}

const webRModule = (instance) => ({
  WebR: vi.fn(function WebR() { return instance; }),
  ChannelType: { PostMessage: 3 },
});

describe('R browser runtime', () => {
  it('registers canonical terminal and Monaco metadata', () => {
    expect(rLanguage).toEqual(expect.objectContaining({
      id: 'r', label: 'R', monacoLanguage: 'r', defaultFileName: 'main.R', executionMode: 'terminal',
    }));
    expect(rLanguage.defaultSource).toBe('print("Hello, World!")');
  });

  it('runs each execution in a fresh PostMessage webR instance and closes it', async () => {
    const first = createFakeWebR();
    const second = createFakeWebR({ captured: { output: [{ type: 'stdout', data: '[1] 30' }] } });
    const loadWebR = vi.fn()
      .mockResolvedValueOnce(webRModule(first))
      .mockResolvedValueOnce(webRModule(second));
    const client = new WebRClient({ baseUrl: 'https://example.test/webr/', loadWebR });

    await expect(client.execute({ source: 'print("Hello")' })).resolves.toEqual(
      expect.objectContaining({ status: 'success', stdout: '[1] "Hello"' }),
    );
    await expect(client.execute({ source: 'print(10 + 20)' })).resolves.toEqual(
      expect.objectContaining({ status: 'success', stdout: '[1] 30' }),
    );
    expect(first.close).toHaveBeenCalled();
    expect(second.close).toHaveBeenCalled();
    expect(loadWebR).toHaveBeenCalledTimes(2);
  });

  it('writes multiline terminal input into the ephemeral webR filesystem', async () => {
    const instance = createFakeWebR();
    const client = new WebRClient({ loadWebR: vi.fn().mockResolvedValue(webRModule(instance)) });
    await client.execute({ source: 'readLines("stdin", n = 2)', stdin: ['5', '10'] });
    expect(instance.FS.writeFile).toHaveBeenCalledWith(
      '/tmp/ycoders-stdin',
      expect.anything(),
    );
    expect(new TextDecoder().decode(instance.FS.writeFile.mock.calls[0][1])).toBe('5\n10\n');
    expect(instance.globalShelter.captureR).toHaveBeenCalledWith(
      expect.stringContaining('.ycoders_stdin_connection'),
      expect.any(Object),
    );
  });

  it('keeps warnings non-fatal and maps messages to stderr', async () => {
    const warning = { toJs: vi.fn().mockResolvedValue({ message: 'NaNs produced' }) };
    const message = { toJs: vi.fn().mockResolvedValue({ message: 'working' }) };
    const instance = createFakeWebR({ captured: { output: [
      { type: 'stdout', data: '[1] NaN' },
      { type: 'warning', data: warning },
      { type: 'message', data: message },
    ] } });
    const client = new WebRClient({ loadWebR: vi.fn().mockResolvedValue(webRModule(instance)) });
    await expect(client.execute({ source: 'sqrt(-1)' })).resolves.toEqual(expect.objectContaining({
      status: 'success', stdout: '[1] NaN', stderr: 'working', warnings: ['NaNs produced'], exitCode: null,
    }));
  });

  it('normalizes R conditions and shared execution evidence', async () => {
    expect(createRExecutionResult({
      status: 'error', stdout: '', stderr: 'object not found\n', warnings: ['warning\n'], exitCode: null, executionTimeMs: 7,
    })).toEqual(expect.objectContaining({
      status: 'error', output: '', errors: ['object not found'], stderr: 'object not found', warnings: ['warning'], exitCode: null,
    }));
  });

  it('terminates timed-out work and creates a clean runtime for the next run', async () => {
    const stuck = createFakeWebR({ pending: true });
    const recovered = createFakeWebR({ captured: { output: [{ type: 'stdout', data: '[1] "recovered"' }] } });
    const loadWebR = vi.fn()
      .mockResolvedValueOnce(webRModule(stuck))
      .mockResolvedValueOnce(webRModule(recovered));
    const client = new WebRClient({ timeoutMs: 5, loadWebR });

    await expect(client.execute({ source: 'while (TRUE) {}' })).rejects.toThrow('exceeded 5 ms');
    expect(stuck.close).toHaveBeenCalled();
    client.timeoutMs = 1_000;
    await expect(client.execute({ source: 'print("recovered")' })).resolves.toEqual(
      expect.objectContaining({ stdout: '[1] "recovered"' }),
    );
    expect(recovered.close).toHaveBeenCalled();
  });

  it('terminates on cancellation, reset, and disposal', async () => {
    const instance = createFakeWebR({ pending: true });
    const client = new WebRClient({ loadWebR: vi.fn().mockResolvedValue(webRModule(instance)) });
    const controller = new AbortController();
    const execution = client.execute({ source: 'while (TRUE) {}', signal: controller.signal });
    await vi.waitFor(() => expect(client.cancelActive).toBeTypeOf('function'));
    controller.abort();
    await expect(execution).rejects.toMatchObject({ name: 'AbortError' });
    expect(instance.close).toHaveBeenCalled();
    client.reset();
    client.dispose();
  });

  it('uses the shared RuntimeAdapter result contract', async () => {
    const client = {
      initialize: vi.fn(),
      execute: vi.fn().mockResolvedValue({ status: 'success', stdout: '[1] 30\n', stderr: '', warnings: [], exitCode: null, executionTimeMs: 2 }),
      reset: vi.fn(),
      dispose: vi.fn(),
    };
    const runtime = new RRuntime({ client });
    await expect(runtime.execute({ source: 'print(10 + 20)' })).resolves.toEqual(
      expect.objectContaining({ status: 'success', output: '[1] 30', warnings: [], exitCode: null }),
    );
  });
});
