import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TeaVMJavaEngine } from '../src/compiler/runtimes/java/TeaVMJavaEngine.js';
import { createJavaExecutionResult } from '../src/compiler/runtimes/java/outputCapture.js';
import { JavaWorkerClient } from '../src/compiler/runtimes/java/JavaWorkerClient.js';
import { createCompilerManager } from '../src/compiler/createCompilerManager.js';

const vendorRoot = resolve('public/vendor/teavm-javac');
const engine = new TeaVMJavaEngine({
  loadAsset: async (name) => new Uint8Array(await readFile(resolve(vendorRoot, name))),
  loadRuntimeModule: () => import(pathToFileURL(resolve(vendorRoot, 'compiler.wasm-runtime.js')).href),
});

async function execute(source, options = {}) {
  const payload = await engine.execute({ source, filename: options.filename ?? 'Main.java', ...options });
  return createJavaExecutionResult({ ...payload, executionTimeMs: 1 });
}

const hello = await execute('class Main { public static void main(String[] args) { System.out.print("Hello Java"); } }');
assert.equal(hello.status, 'success');
assert.equal(hello.output, 'Hello Java');

const streams = await execute('class Main { public static void main(String[] args) { System.out.println("out"); System.err.println("err"); } }');
assert.equal(streams.output, 'out');
assert.deepEqual(streams.errors, ['err']);

const input = await execute('import java.util.Scanner; class Main { public static void main(String[] args) { Scanner in = new Scanner(System.in); System.out.print(in.nextInt() * 2); } }', { stdin: '21\n' });
assert.equal(input.output, '42');

const method = await execute('class Solution { public int add(int left, int right) { return left + right; } }', {
  filename: 'Solution.java',
  execution: { mode: 'method', className: 'Solution', methodName: 'add', arguments: [7, 5] },
});
assert.equal(method.output, '12');

const java17 = await execute('record Point(int value) {} class Main { public static void main(String[] args) { System.out.print(new Point(17).value()); } }');
assert.equal(java17.output, '17');

const compilationFailure = await execute('class Main { public static void main(String[] args) { missing syntax } }');
assert.equal(compilationFailure.status, 'error');
assert.match(compilationFailure.errors.join('\n'), /Main\.java/);

const runtimeFailure = await execute('class Main { public static void main(String[] args) { int value = 1 / 0; System.out.print(value); } }');
assert.equal(runtimeFailure.status, 'error');
assert.match(runtimeFailure.errors.join('\n'), /ArithmeticException|\/ by zero|divide by zero/i);

engine.dispose();

const manager = createCompilerManager();
assert.equal(manager.runtimeRegistry.getInitializedRuntimes().length, 0, 'Creating the manager must not initialize Java.');
manager.runtimeRegistry.register('java-test-double', () => ({
  initialize: async () => {},
  execute: async ({ stdin }) => ({ status: 'success', output: stdin, errors: [], executionTimeMs: 1 }),
  reset: async () => {},
  dispose: async () => {},
}));
const testCaseResults = await manager.executeTests({
  language: 'java-test-double',
  source: '',
  validatorType: 'normalized_output',
  testCases: [
    { id: 'case-one', stdin: 'one', expectedOutput: 'one' },
    { id: 'case-two', stdin: 'two', expectedOutput: 'two' },
  ],
});
assert.deepEqual(testCaseResults.map(({ passed }) => passed), [true, true]);

const OriginalWorker = globalThis.Worker;
let workerTerminated = false;
globalThis.Worker = class SilentWorker {
  addEventListener() {}
  postMessage() {}
  terminate() { workerTerminated = true; }
};
const timeoutClient = new JavaWorkerClient({ timeoutMs: 10 });
await assert.rejects(
  timeoutClient.execute({ source: 'class Main {}' }),
  /execution exceeded 10 ms/,
);
assert.equal(workerTerminated, true);
timeoutClient.dispose();
globalThis.Worker = OriginalWorker;

console.log(JSON.stringify({
  runtime: 'TeaVM Java',
  programExecution: 'passed',
  methodExecution: 'passed',
  java17LanguageFeature: 'passed',
  stdin: 'passed',
  stdout: 'passed',
  stderr: 'passed',
  compilationErrors: 'passed',
  runtimeErrors: 'passed',
  timeout: 'passed',
  lazyInitialization: 'passed',
  multipleTestCases: 'passed',
}, null, 2));
