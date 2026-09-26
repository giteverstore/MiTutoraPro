import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AssemblyRuntime } from '../../src/compiler/runtimes/assembly/AssemblyRuntime.js';
import { AssemblyWorkerClient } from '../../src/compiler/runtimes/assembly/AssemblyWorkerClient.js';
import { normalizeAssemblyResult } from '../../src/compiler/runtimes/assembly/normalizeAssemblyResult.js';
import { assemblyLanguage } from '../../src/compiler/languages/assembly.js';
import { EmulatorResultPanel } from '../../src/components/EmulatorResultPanel.jsx';

class FakeWorker {
  constructor() { this.listeners = {}; this.messages = []; this.terminated = false; }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  removeEventListener() {}
  postMessage(message) { this.messages.push(message); }
  terminate() { this.terminated = true; }
  emit(data) { this.listeners.message?.({ data }); }
}

describe('x86-64 Assembly runtime', () => {
  it('registers canonical emulator metadata without constructing its runtime eagerly', () => {
    expect(assemblyLanguage).toEqual(expect.objectContaining({
      id: 'assembly', label: 'Assembly', monacoLanguage: 'asm',
      defaultFileName: 'main.asm', executionMode: 'emulator',
    }));
    expect(assemblyLanguage.defaultSource).toContain('add rax, rbx');
  });

  it('routes source through a disposable worker with an instruction limit', async () => {
    const worker = new FakeWorker();
    const client = new AssemblyWorkerClient({ workerFactory: () => worker, initializationTimeoutMs: 100, timeoutMs: 100 });
    const pending = client.execute({ source: 'mov rax, 10' });
    expect(worker.messages[0]).toEqual(expect.objectContaining({
      type: 'execute', source: 'mov rax, 10', instructionLimit: 1_000_000,
    }));
    worker.emit({ type: 'initialized', id: 1, timeoutMs: 100 });
    worker.emit({ type: 'result', id: 1, status: 'success', stdout: '', errors: [], emulator: { instructionCount: 1 } });
    await expect(pending).resolves.toEqual(expect.objectContaining({ status: 'success' }));
    expect(worker.terminated).toBe(true);
  });

  it('terminates the worker on cancellation and creates a clean next run', async () => {
    const workers = [];
    const client = new AssemblyWorkerClient({ workerFactory: () => { const worker = new FakeWorker(); workers.push(worker); return worker; } });
    const controller = new AbortController();
    const first = client.execute({ source: 'forever: jmp forever', signal: controller.signal });
    controller.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers[0].terminated).toBe(true);
    const second = client.execute({ source: 'mov rax, 1' });
    workers[1].emit({ type: 'result', id: 2, status: 'success', stdout: '', errors: [] });
    await expect(second).resolves.toEqual(expect.objectContaining({ status: 'success' }));
  });

  it('normalizes BigInt-safe emulator evidence without converting register values', async () => {
    const client = { initialize: vi.fn(), execute: vi.fn().mockResolvedValue({
      status: 'success', stdout: '', errors: [], executionTimeMs: 3,
      emulator: { registers: { rax: '0xFFFFFFFFFFFFFFFF' }, flags: { zf: false } },
    }), reset: vi.fn(), dispose: vi.fn() };
    const runtime = new AssemblyRuntime({ client });
    const result = await runtime.execute({ source: 'not rax' });
    expect(result.emulator.registers.rax).toBe('0xFFFFFFFFFFFFFFFF');
    expect(result.metadata).toEqual(expect.objectContaining({ architecture: 'x86-64', assembler: 'NASM 3.00' }));
  });

  it('preserves structured assembler diagnostics', () => {
    expect(normalizeAssemblyResult({ status: 'error', errors: ['invalid opcode'], diagnostics: [{ line: 2, severity: 'error' }] }))
      .toEqual(expect.objectContaining({ status: 'error', diagnostics: [{ line: 2, severity: 'error' }] }));
  });

  it('renders registers, flags, instruction count, and stack evidence', () => {
    const registers = Object.fromEntries(['rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi', 'rsp', 'rbp', 'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15', 'rip'].map((name) => [name, '0x0000000000000000']));
    registers.rax = '0x000000000000001E';
    render(<EmulatorResultPanel emulator={{ registers, flags: { zf: true }, changedRegisters: ['rax'], instructionCount: 3, stack: { rsp: registers.rsp, bytes: [] } }} result="" error="" isRunning={false} executionTimeMs={4} executionStatus="success" height={260} collapsed={false} />);
    expect(screen.getByText('0x000000000000001E')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('Instructions')).toBeInTheDocument();
    expect(screen.getByText('ZF').closest('span')).toHaveClass('is-set');
  });
});
