import { createCompiler } from '@live-codes/clang-wasm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NativeCompilerRuntime } from '../../src/compiler/runtimes/native/NativeCompilerRuntime.js';
import { NativeCompilerWorkerClient } from '../../src/compiler/runtimes/native/NativeCompilerWorkerClient.js';
import { normalizeNativeExecutionResult } from '../../src/compiler/runtimes/native/nativeExecution.js';

let cCompiler;
let cppCompiler;

beforeAll(async () => {
  cCompiler = await createCompiler('c', { std: 'gnu17', compileArgs: ['-Wall', '-Wextra'] });
  cppCompiler = await createCompiler('cpp', { std: 'gnu++17', compileArgs: ['-Wall', '-Wextra'] });
}, 30_000);

afterAll(() => {
  cCompiler?.dispose();
  cppCompiler?.dispose();
});

describe('real browser-compatible Clang runtime', () => {
  it.each([
    ['C', () => cCompiler, '#include <stdio.h>\nint main(void) { puts("Hello"); return 0; }', 'main.c'],
    ['C++', () => cppCompiler, '#include <iostream>\nint main() { std::cout << "Hello\\n"; return 0; }', 'main.cpp'],
  ])('runs a %s hello-world program', async (_label, compiler, source, fileName) => {
    const result = await compiler().run(source, '', { fileName });
    expect(result).toEqual(expect.objectContaining({ stdout: 'Hello\n', errors: [], exitCode: 0 }));
  }, 40_000);

  it('compiles C17, reads stdin, and captures stdout', async () => {
    const result = await cCompiler.run(`#include <stdio.h>
int main(void) {
  int value = 0;
  if (scanf("%d", &value) != 1) return 2;
  printf("%d\\n", value * 2);
  return 0;
}`, '21\n', { fileName: 'main.c' });
    const normalized = normalizeNativeExecutionResult(result, 'c');
    expect(normalized).toEqual(expect.objectContaining({ status: 'success', output: '42\n', stdout: '42\n', exitCode: 0 }));
  }, 40_000);

  it('supports common C standard-library headers', async () => {
    const result = await cCompiler.run(`#include <math.h>
#include <stdio.h>
#include <string.h>
int main(void) { printf("%.0f %zu\\n", sqrt(81.0), strlen("ycoders")); return 0; }`, '', { fileName: 'main.c' });
    expect(result).toEqual(expect.objectContaining({ stdout: '9 7\n', errors: [], exitCode: 0 }));
  }, 40_000);

  it('consumes multiline C input and captures stderr separately', async () => {
    const result = await cCompiler.run(`#include <stdio.h>
int main(void) { int a, b; scanf("%d%d", &a, &b); fprintf(stderr, "sum:"); printf("%d\\n", a + b); return 0; }`, '5\n10\n', { fileName: 'main.c' });
    expect(result).toEqual(expect.objectContaining({ stdout: '15\n', stderr: 'sum:', exitCode: 0 }));
  }, 40_000);

  it('compiles C++17 with STL containers and algorithms', async () => {
    const result = await cppCompiler.run(`#include <algorithm>
#include <iostream>
#include <vector>
int main() {
  std::vector<int> values{3, 1, 2};
  std::sort(values.begin(), values.end());
  for (int value : values) std::cout << value;
  std::cout << '\\n';
  return 0;
}`, '', { fileName: 'main.cpp' });
    expect(result).toEqual(expect.objectContaining({ stdout: '123\n', errors: [], exitCode: 0 }));
  }, 40_000);

  it('supports C++ string input and stderr', async () => {
    const result = await cppCompiler.run(`#include <iostream>
#include <string>
int main() { std::string name; std::getline(std::cin, name); std::cerr << "read"; std::cout << "Hello " << name << '\\n'; }`, 'Avi\n', { fileName: 'main.cpp' });
    expect(result).toEqual(expect.objectContaining({ stdout: 'Hello Avi\n', stderr: 'read', exitCode: 0 }));
  }, 40_000);

  it('does not turn enabled compiler warnings into execution failures', async () => {
    const result = await cCompiler.run('int main(void) { int unused = 1; return 0; }', '', { fileName: 'main.c' });
    expect(result).toEqual(expect.objectContaining({ errors: [], exitCode: 0 }));
  }, 40_000);

  it.each([
    ['c', () => cCompiler, 'int main(void) { return missing_symbol; }', 'main.c'],
    ['cpp', () => cppCompiler, 'int main() { std::cout << "missing include"; }', 'main.cpp'],
  ])('returns useful %s compile diagnostics', async (_language, compiler, source, fileName) => {
    const result = await compiler().run(source, '', { fileName });
    expect(result.exitCode).toBeNull();
    expect(result.errors.join('\n')).toMatch(/error:/i);
    expect(result.errors.join('\n')).toContain(fileName);
  }, 40_000);

  it('distinguishes nonzero runtime termination from compile failure', async () => {
    const result = await cCompiler.run('int main(void) { return 7; }', '', { fileName: 'main.c' });
    expect(normalizeNativeExecutionResult(result, 'c')).toEqual(expect.objectContaining({
      status: 'error', phase: 'runtime', exitCode: 7, diagnostics: [],
    }));
  }, 40_000);
});

class FakeWorker {
  listeners = new Map();
  terminate = vi.fn();
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  removeEventListener(type, callback) { if (this.listeners.get(type) === callback) this.listeners.delete(type); }
  postMessage = vi.fn((message) => {
    this.lastMessage = message;
    if (this.autoRespond) queueMicrotask(() => this.listeners.get('message')?.({ data: { id: message.id, status: 'success', output: 'ok' } }));
  });
}

describe('native compiler worker lifecycle', () => {
  it('cleans successful workers and creates a fresh isolated execution', async () => {
    const first = new FakeWorker();
    const second = new FakeWorker();
    first.autoRespond = true;
    second.autoRespond = true;
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const client = new NativeCompilerWorkerClient({ workerFactory: factory });
    await client.execute({ language: 'c', source: 'int main(void){}' });
    await client.execute({ language: 'c', source: 'int main(void){return 0;}' });
    expect(factory).toHaveBeenCalledTimes(2);
    expect(first.terminate).toHaveBeenCalledOnce();
    expect(second.terminate).toHaveBeenCalledOnce();
    client.dispose();
  });

  it('terminates runaway work on timeout and starts clean next time', async () => {
    const first = new FakeWorker();
    const second = new FakeWorker();
    second.autoRespond = true;
    const client = new NativeCompilerWorkerClient({ timeoutMs: 5, workerFactory: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second) });
    await expect(client.execute({ language: 'cpp', source: 'for(;;){}' })).rejects.toThrow('exceeded 5 ms');
    expect(first.terminate).toHaveBeenCalledOnce();
    await expect(client.execute({ language: 'cpp', source: 'int main(){}' })).resolves.toEqual(expect.objectContaining({ output: 'ok' }));
  });

  it('cancels through AbortSignal and reset/dispose are safe', async () => {
    const worker = new FakeWorker();
    const client = new NativeCompilerWorkerClient({ workerFactory: () => worker });
    const controller = new AbortController();
    const execution = client.execute({ language: 'c', source: 'for(;;){}', signal: controller.signal });
    controller.abort();
    await expect(execution).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).toHaveBeenCalledOnce();
    client.reset();
    client.dispose();
  });

  it('shares one runtime adapter architecture across C and C++', async () => {
    const client = { initialize: vi.fn(), execute: vi.fn().mockResolvedValue({ status: 'success' }), reset: vi.fn(), dispose: vi.fn() };
    const c = new NativeCompilerRuntime({ language: 'c', client });
    const cpp = new NativeCompilerRuntime({ language: 'cpp', client });
    await c.execute({ source: 'c source' });
    await cpp.execute({ source: 'cpp source' });
    expect(client.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({ language: 'c' }));
    expect(client.execute).toHaveBeenNthCalledWith(2, expect.objectContaining({ language: 'cpp' }));
  });
});
