import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { PythonRuntime } from '../../src/compiler/runtimes/python/PythonRuntime.js';

const workerSource = readFileSync(resolve(process.cwd(), 'src/compiler/runtimes/python/python.worker.js'), 'utf8');

describe('Pyodide capability and state policy', () => {
  it('does not auto-fetch packages and blocks browser/network bridges', () => {
    expect(workerSource).not.toContain('loadPackagesFromImports');
    expect(workerSource).toContain("'micropip'");
    expect(workerSource).toContain("'pyodide'");
    expect(workerSource).toContain("'js'");
    expect(workerSource).toContain("'fetch'");
    expect(workerSource).toContain("'indexedDB'");
    expect(workerSource).toContain("'Worker'");
    expect(workerSource).toContain('_restricted_import');
  });

  it('initializes the disposable client before every execution', async () => {
    const client = {
      initialize: vi.fn().mockResolvedValue({ type: 'initialized' }),
      execute: vi.fn().mockResolvedValue({ status: 'success', stdout: 'ok\n', stderr: '', executionTimeMs: 1 }),
    };
    const runtime = new PythonRuntime({ client });
    await runtime.execute({ source: 'print("ok")' });
    await runtime.execute({ source: 'print("ok")' });
    expect(client.initialize).toHaveBeenCalledTimes(2);
    expect(client.execute).toHaveBeenCalledTimes(2);
  });
});
