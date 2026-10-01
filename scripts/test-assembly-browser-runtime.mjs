import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { startBrowserRuntimeServer } from './browser-runtime-harness.mjs';

const { server, baseUrl, probeUrl } = await startBrowserRuntimeServer();
const minimalRepeat = Number(process.argv.find((argument) => argument.startsWith('--minimal-repeat='))?.split('=')[1] ?? 0);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const stage = (message) => console.log(`[assembly-browser] ${message}`);
page.on('console', (message) => stage(`console:${message.type()}: ${message.text()}`));
page.on('pageerror', (error) => stage(`pageerror: ${error.message}`));
page.on('requestfailed', (request) => stage(`requestfailed: ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`));
page.on('worker', (worker) => {
  stage(`worker-created: ${worker.url()}`);
  worker.on('close', () => stage(`worker-closed: ${worker.url()}`));
});

try {
  stage(`server-ready: ${baseUrl}`);
  await page.goto(probeUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  stage('page-loaded');
  const execute = (source, options = {}) => page.evaluate(async ({ source, options }) => {
    const { AssemblyWorkerClient } = await import('/src/compiler/runtimes/assembly/AssemblyWorkerClient.js');
    const client = new AssemblyWorkerClient(options);
    try { return await client.execute({ source, timeoutMs: options.timeoutMs }); }
    finally { client.dispose(); }
  }, {
    source,
    options: { initializationTimeoutMs: 120_000, timeoutMs: 10_000, ...options },
  });

  stage('arithmetic-start');
  const arithmetic = await execute('mov rax, 10\nmov rbx, 20\nadd rax, rbx');
  stage('arithmetic-complete');
  assert.equal(arithmetic.status, 'success');
  assert.equal(arithmetic.emulator.registers.rax, '0x000000000000001E');
  assert.equal(arithmetic.emulator.registers.rbx, '0x0000000000000014');

  if (minimalRepeat > 0) {
    for (let cycle = 2; cycle <= minimalRepeat; cycle += 1) {
      stage(`minimal-cycle-${cycle}-start`);
      const result = await execute('mov rax, 10\nmov rbx, 20\nadd rax, rbx');
      assert.equal(result.status, 'success');
      assert.equal(result.emulator.registers.rax, '0x000000000000001E');
      stage(`minimal-cycle-${cycle}-complete`);
    }
    console.log(`x86-64 Assembly minimal browser acceptance passed ${minimalRepeat}/${minimalRepeat}.`);
  } else {

  const instructionCoverage = await execute(`jmp start
value: dq 99
start:
lea rsi, [rel value]
mov rax, 3
add rax, 2
sub rax, 1
imul rax, 3
xor rdx, rdx
mov rcx, 2
idiv rcx
inc rax
dec rax
and rax, 7
or rax, 8
xor rax, 2
mov r8, 1
shl r8, 3
shr r8, 1
sar r8, 1
xor r10, r10
not r10
test rax, rax
cmp rax, 1
jg greater
mov r9, 0
greater:
cmp rax, rax
jge greater_equal
mov r9, 0
greater_equal:
cmp rax, 100
jl less
mov r9, 0
less:
cmp rax, rax
jle done_coverage
mov r9, 0
done_coverage:
mov r9, 15`);
  assert.equal(instructionCoverage.status, 'success');
  assert.equal(instructionCoverage.emulator.registers.r8, '0x0000000000000002');
  assert.equal(instructionCoverage.emulator.registers.r9, '0x000000000000000F');
  assert.equal(instructionCoverage.emulator.registers.r10, '0xFFFFFFFFFFFFFFFF');

  const branch = await execute(`mov rax, 5
cmp rax, 5
je equal
mov rbx, 0
jmp done
equal:
mov rbx, 1
done:
nop`);
  assert.equal(branch.emulator.registers.rbx, '0x0000000000000001');

  const stack = await execute('mov rax, 42\npush rax\npop rbx');
  assert.equal(stack.emulator.registers.rbx, '0x000000000000002A');

  const memory = await execute('mov rax, 0x1122334455667788\npush rax\nmov rbx, [rsp]\npop rcx');
  assert.equal(memory.emulator.registers.rbx, '0x1122334455667788');
  assert.equal(memory.emulator.registers.rcx, '0x1122334455667788');

  const call = await execute(`mov rax, 10
call add_twenty
mov rbx, rax
jmp done
add_twenty:
add rax, 20
ret
done:
nop`);
  assert.equal(call.emulator.registers.rbx, '0x000000000000001E');

  const data = await execute(`jmp start
value: dq 10
start:
mov rax, [rel value]`);
  assert.equal(data.emulator.registers.rax, '0x000000000000000A');

  const zero = await execute('mov rax, 1\nsub rax, 1');
  assert.equal(zero.emulator.flags.zf, true);
  const carry = await execute('xor rax, rax\nsub rax, 1');
  assert.equal(carry.emulator.flags.cf, true);
  assert.equal(carry.emulator.flags.sf, true);
  const overflow = await execute('mov rax, 0x7FFFFFFFFFFFFFFF\nadd rax, 1');
  assert.equal(overflow.emulator.flags.of, true);

  const output = await execute(`jmp start
message: db "Hello"
start:
mov rax, 1
mov rdi, 1
lea rsi, [rel message]
mov rdx, 5
syscall`);
  assert.equal(output.stdout, 'Hello');

  const syntaxError = await execute('mov rax,');
  assert.equal(syntaxError.status, 'error');
  assert.equal(syntaxError.metadata.phase, 'assembly');
  assert.ok(syntaxError.diagnostics.some(({ line, severity }) => line === 1 && severity === 'error'));
  const invalidRegister = await execute('mov r99, 1');
  assert.equal(invalidRegister.status, 'error');
  const invalidOpcode = await execute('definitely_not_an_opcode rax');
  assert.equal(invalidOpcode.status, 'error');

  const divideByZero = await execute('mov rax, 10\nxor rdx, rdx\nxor rbx, rbx\nidiv rbx');
  assert.equal(divideByZero.status, 'error');
  assert.match(divideByZero.errors[0], /divide by zero/i);
  const invalidMemory = await execute('mov rax, 1\nmov rbx, [rax]');
  assert.equal(invalidMemory.status, 'error');
  assert.match(invalidMemory.errors[0], /invalid memory access/i);
  const invalidJump = await execute('mov rax, 0x500000\njmp rax');
  assert.equal(invalidJump.status, 'error');
  assert.match(invalidJump.errors[0], /invalid jump target/i);
  const blockedSyscall = await execute('mov rax, 2\nsyscall');
  assert.match(blockedSyscall.errors[0], /syscall 2 is not available/i);

  const recovery = await page.evaluate(async () => {
    const { AssemblyWorkerClient } = await import('/src/compiler/runtimes/assembly/AssemblyWorkerClient.js');
    const client = new AssemblyWorkerClient({ instructionLimit: 1_000, timeoutMs: 10_000 });
    const limited = await client.execute({ source: 'forever:\njmp forever' });
    const recovered = await client.execute({ source: 'mov rax, 7' });
    client.dispose();
    return { limited, recovered };
  });
  assert.match(recovery.limited.errors[0], /instruction limit exceeded/i);
  assert.equal(recovery.recovered.emulator.registers.rax, '0x0000000000000007');

  console.log('x86-64 Assembly browser runtime tests passed.');
  console.log(JSON.stringify({
    coldInitializationMs: arithmetic.metadata.initializationTimeMs,
    assemblyMs: arithmetic.metadata.assemblyTimeMs,
    emulationMs: arithmetic.metadata.emulationTimeMs,
    wasmMemoryBytes: arithmetic.emulator.memory.wasmBytes,
  }));
  }
} finally {
  stage('browser-close-start');
  await browser.close();
  stage('browser-close-complete');
  await server.close();
  stage('server-close-complete');
}
