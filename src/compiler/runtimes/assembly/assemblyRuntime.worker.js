import nasmUrl from './assets/nasm.3.00.elf?url';
import {
  ASSEMBLY_CODE_BASE,
  ASSEMBLY_INSTRUCTION_LIMIT,
  ASSEMBLY_STACK_BYTES,
} from './assemblyRuntimeConfig.js';

const PRELUDE_LINES = 2;
const SIGNAL_TRAP = 5;
const TRAP_PREEMPT = 40;
const TRAP_STEP = 41;
const REGISTER_NAMES = Object.freeze([
  'rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi', 'rsp', 'rbp',
  'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15', 'rip',
]);
const FLAG_MASKS = Object.freeze({ cf: 0x1n, pf: 0x4n, af: 0x10n, zf: 0x40n, sf: 0x80n, of: 0x800n });

// The upstream Emscripten artifact detects classic workers through this name.
// It never calls importScripts because the artifact is an ES module.
if (typeof globalThis.importScripts !== 'function') globalThis.importScripts = () => {};

function parseNasmDiagnostics(logs) {
  return String(logs ?? '').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^.*?:(\d+):\s*(error|warning):\s*(.*)$/i);
    if (!match) return [];
    return [{
      severity: match[2].toLowerCase(),
      line: Math.max(1, Number(match[1]) - PRELUDE_LINES),
      column: null,
      message: match[3].trim(),
      code: 'NASM',
    }];
  });
}

function createElf64(rawCode) {
  const headerSize = 64;
  const programHeaderSize = 56;
  const codeOffset = 0x1000;
  const imageBase = ASSEMBLY_CODE_BASE - BigInt(codeOffset);
  const fileSize = codeOffset + rawCode.length;
  const bytes = new Uint8Array(fileSize);
  const view = new DataView(bytes.buffer);

  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0], 0);
  view.setUint16(16, 2, true); // ET_EXEC
  view.setUint16(18, 62, true); // EM_X86_64
  view.setUint32(20, 1, true);
  view.setBigUint64(24, ASSEMBLY_CODE_BASE, true);
  view.setBigUint64(32, BigInt(headerSize), true);
  view.setBigUint64(40, 0n, true);
  view.setUint32(48, 0, true);
  view.setUint16(52, headerSize, true);
  view.setUint16(54, programHeaderSize, true);
  view.setUint16(56, 1, true);

  view.setUint32(headerSize, 1, true); // PT_LOAD
  view.setUint32(headerSize + 4, 7, true); // RWX, isolated virtual memory only
  view.setBigUint64(headerSize + 8, 0n, true);
  view.setBigUint64(headerSize + 16, imageBase, true);
  view.setBigUint64(headerSize + 24, imageBase, true);
  view.setBigUint64(headerSize + 32, BigInt(fileSize), true);
  view.setBigUint64(headerSize + 40, BigInt(fileSize), true);
  view.setBigUint64(headerSize + 48, 0x1000n, true);
  bytes.set(rawCode, codeOffset);
  return bytes;
}

class MachineView {
  constructor(memory, structPointer) {
    this.memory = memory;
    this.structPointer = structPointer;
    this.keys = Object.freeze({
      version: [0, false], codemem: [1, true], stackmem: [2, true],
      readaddr: [3, true], readsize: [4, false], writeaddr: [5, true], writesize: [6, false],
      flags: [7, false], csBase: [8, true], rip: [9, true], rsp: [10, true], rbp: [11, true],
      rsi: [12, true], rdi: [13, true], r8: [14, true], r9: [15, true], r10: [16, true],
      r11: [17, true], r12: [18, true], r13: [19, true], r14: [20, true], r15: [21, true],
      rax: [22, true], rbx: [23, true], rcx: [24, true], rdx: [25, true],
    });
    this.refresh();
  }

  refresh() {
    this.data = new DataView(this.memory.buffer);
    this.struct = new DataView(this.memory.buffer, this.structPointer, 30 * 4);
  }

  pointer(name) {
    if (!this.struct.buffer.byteLength) this.refresh();
    return this.struct.getUint32(this.keys[name][0] * 4, true);
  }

  u64(name) {
    const pointer = this.pointer(name);
    return this.data.getBigUint64(pointer, true);
  }

  writeAscii(pointer, text, maxLength) {
    if (!this.struct.buffer.byteLength) this.refresh();
    const value = String(text ?? '').slice(0, maxLength - 1);
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      this.data.setUint8(pointer + index, code >= 0x20 && code <= 0x7e ? code : 0x20);
    }
    this.data.setUint8(pointer + value.length, 0);
  }
}

class AssemblyEngine {
  constructor() {
    this.state = 'not-ready';
    this.stdout = '';
    this.stderr = '';
    this.assemblerLogs = '';
    this.stopReason = null;
    this.compileResolve = null;
  }

  async initialize() {
    const { default: createBlinkModule } = await import('./assets/blinkenlib.js');
    this.module = await createBlinkModule({
      noInitialRun: true,
      preRun: (module) => {
        module.FS.init(
          () => null,
          (charCode) => this.collectOutput(charCode, false),
          (charCode) => this.collectOutput(charCode, true),
        );
        module.FS.createPreloadedFile('/', 'assembler', nasmUrl, true, true);
      },
    });

    const signalPointer = this.module.addFunction((signal, code) => this.handleSignal(signal, code), 'vii');
    const exitPointer = this.module.addFunction((code) => this.handleExit(code), 'vi');
    this.module.callMain([String(signalPointer), String(exitPointer)]);
    this.machine = new MachineView(this.module.wasmExports.memory, this.module._blinkenlib_get_clstruct());
    this.argcPointer = this.module._blinkenlib_get_argc_string();
    this.argvPointer = this.module._blinkenlib_get_argv_string();
    this.programPointer = this.module._blinkenlib_get_progname_string();
    this.state = 'ready';
  }

  collectOutput(charCode, isError) {
    const character = String.fromCharCode(charCode);
    if (this.state === 'assembling') this.assemblerLogs += character;
    else if (isError) this.stderr += character;
    else this.stdout += character;
  }

  setArguments(program, argc = program, argv = '') {
    this.machine.writeAscii(this.programPointer, program, 200);
    this.machine.writeAscii(this.argcPointer, argc, 200);
    this.machine.writeAscii(this.argvPointer, argv, 200);
  }

  handleSignal(signal, code) {
    if (signal === SIGNAL_TRAP && code === TRAP_PREEMPT) {
      setTimeout(() => this.module._blinkenlib_preempt_resume(), 0);
      return;
    }
    if (signal === SIGNAL_TRAP && code === TRAP_STEP) return;
    this.stopReason = {
      exitCode: 128 + signal,
      message: signal === 8 ? 'Runtime error: divide by zero.'
        : signal === 11 ? 'Runtime error: invalid memory access.'
          : signal === 4 ? 'Runtime error: invalid instruction.'
            : `Runtime error: emulator stopped with signal ${signal}.`,
    };
    this.state = 'stopped';
  }

  handleExit(code) {
    if (this.state === 'assembling') {
      const resolve = this.compileResolve;
      this.compileResolve = null;
      this.state = 'ready';
      resolve?.(code);
      return;
    }
    this.stopReason = { exitCode: code, message: code ? `Program exited with code ${code}.` : '' };
    this.state = 'stopped';
  }

  async assemble(source) {
    this.stdout = '';
    this.stderr = '';
    this.assemblerLogs = '';
    this.stopReason = null;
    const prepared = `[BITS 64]\n[ORG 0x${ASSEMBLY_CODE_BASE.toString(16)}]\n${source}\n`;
    this.module.FS.writeFile('/assembly.s', prepared);
    this.state = 'assembling';
    const exitCode = await new Promise((resolve) => {
      this.compileResolve = resolve;
      setTimeout(() => {
        this.setArguments('/assembler', '/assembler -f bin /assembly.s -o /program.bin');
        this.module._blinkenlib_run_fast();
      }, 0);
    });
    const diagnostics = parseNasmDiagnostics(this.assemblerLogs);
    if (exitCode !== 0) return { diagnostics, rawCode: null };
    const rawCode = this.module.FS.readFile('/program.bin');
    return { diagnostics, rawCode: new Uint8Array(rawCode) };
  }

  load(rawCode) {
    const elf = createElf64(rawCode);
    this.module.FS.writeFile('/program', elf);
    this.module.FS.chmod('/program', 0o777);
    this.setArguments('/program');
    this.module._blinkenlib_starti();
    // Blink prints its synthetic launch prompt while loading the ELF. Learner
    // output begins only after the entrypoint trap is reached.
    this.stdout = '';
    this.stderr = '';
    this.state = 'running';
  }

  snapshot(initialRegisters = null) {
    const registers = Object.fromEntries(REGISTER_NAMES.map((name) => {
      const value = this.machine.u64(name);
      return [name, `0x${value.toString(16).padStart(16, '0').toUpperCase()}`];
    }));
    const flagsValue = this.machine.u64('flags');
    const flags = Object.fromEntries(Object.entries(FLAG_MASKS).map(([name, mask]) => [name, Boolean(flagsValue & mask)]));
    const stackPointer = this.machine.u64('rsp');
    const stackMemoryPointer = this.machine.pointer('stackmem');
    const stackBytes = [];
    for (let index = 0; index < ASSEMBLY_STACK_BYTES; index += 1) {
      stackBytes.push(this.machine.data.getUint8(stackMemoryPointer + index).toString(16).padStart(2, '0').toUpperCase());
    }
    const changedRegisters = initialRegisters
      ? REGISTER_NAMES.filter((name) => registers[name] !== initialRegisters[name])
      : [];
    return {
      registers,
      flags,
      flagsHex: `0x${flagsValue.toString(16).padStart(16, '0').toUpperCase()}`,
      changedRegisters,
      memory: {
        codeBase: `0x${ASSEMBLY_CODE_BASE.toString(16).padStart(16, '0').toUpperCase()}`,
        endianness: 'little',
        wasmBytes: this.module.wasmExports.memory.buffer.byteLength,
      },
      stack: {
        rsp: `0x${stackPointer.toString(16).padStart(16, '0').toUpperCase()}`,
        bytes: stackBytes,
      },
    };
  }

  async execute(rawCode, instructionLimit) {
    this.load(rawCode);
    const initial = this.snapshot().registers;
    const codeEnd = ASSEMBLY_CODE_BASE + BigInt(rawCode.length);
    let instructionCount = 0;

    while (this.state === 'running') {
      for (let batch = 0; batch < 500 && this.state === 'running'; batch += 1) {
        const rip = this.machine.u64('rip');
        if (rip === codeEnd) {
          this.state = 'completed';
          break;
        }
        if (rip < ASSEMBLY_CODE_BASE || rip > codeEnd) {
          this.stopReason = { exitCode: 1, message: 'Runtime error: invalid jump target.' };
          this.state = 'stopped';
          break;
        }
        if (instructionCount >= instructionLimit) {
          this.stopReason = { exitCode: 124, message: 'Execution stopped: instruction limit exceeded.' };
          this.state = 'stopped';
          break;
        }
        const codeOffset = Number(rip - ASSEMBLY_CODE_BASE);
        if (rawCode[codeOffset] === 0x0f && rawCode[codeOffset + 1] === 0x05) {
          const syscall = this.machine.u64('rax');
          const descriptor = this.machine.u64('rdi');
          if (syscall !== 1n && syscall !== 60n) {
            this.stopReason = { exitCode: 1, message: `Runtime error: syscall ${syscall} is not available in the educational emulator.` };
            this.state = 'stopped';
            break;
          }
          if (syscall === 1n && descriptor !== 1n && descriptor !== 2n) {
            this.stopReason = { exitCode: 1, message: 'Runtime error: write is limited to stdout and stderr.' };
            this.state = 'stopped';
            break;
          }
        }
        this.module._blinkenlib_stepi();
        instructionCount += 1;
      }
      if (this.state === 'running') await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return { instructionCount, snapshot: this.snapshot(initial), stopReason: this.stopReason };
  }
}

self.addEventListener('message', async ({ data }) => {
  if (data?.type !== 'execute') return;
  const startedAt = performance.now();
  try {
    const engine = new AssemblyEngine();
    await engine.initialize();
    const initializedAt = performance.now();
    self.postMessage({ type: 'initialized', id: data.id, timeoutMs: data.timeoutMs });
    const assembled = await engine.assemble(String(data.source ?? ''));
    const assembledAt = performance.now();
    if (!assembled.rawCode) {
      self.postMessage({
        type: 'result', id: data.id, status: 'error', stdout: '', stderr: engine.assemblerLogs,
        diagnostics: assembled.diagnostics,
        errors: [assembled.diagnostics[0]?.message ?? 'Assembly failed.'],
        executionTimeMs: Math.round(performance.now() - startedAt),
        metadata: {
          phase: 'assembly',
          initializationTimeMs: Math.round(initializedAt - startedAt),
          assemblyTimeMs: Math.round(assembledAt - initializedAt),
        },
      });
      return;
    }

    const execution = await engine.execute(
      assembled.rawCode,
      Math.max(1, Number(data.instructionLimit ?? ASSEMBLY_INSTRUCTION_LIMIT)),
    );
    const errorMessage = execution.stopReason?.message ?? '';
    const success = !errorMessage;
    self.postMessage({
      type: 'result', id: data.id, status: success ? 'success' : 'error',
      stdout: engine.stdout, stderr: engine.stderr,
      diagnostics: assembled.diagnostics,
      errors: success ? [] : [errorMessage],
      exitCode: execution.stopReason?.exitCode ?? 0,
      executionTimeMs: Math.round(performance.now() - startedAt),
      emulator: {
        ...execution.snapshot,
        instructionCount: execution.instructionCount,
        codeSize: assembled.rawCode.length,
      },
      metadata: {
        phase: success ? 'complete' : 'execution',
        initializationTimeMs: Math.round(initializedAt - startedAt),
        assemblyTimeMs: Math.round(assembledAt - initializedAt),
        emulationTimeMs: Math.round(performance.now() - assembledAt),
      },
    });
  } catch (error) {
    self.postMessage({
      type: 'result', id: data.id, status: 'error', stdout: '', stderr: '', diagnostics: [],
      errors: [error?.message ?? 'Assembly runtime failed.'],
      executionTimeMs: Math.round(performance.now() - startedAt),
      metadata: { phase: 'runtime' },
    });
  }
});
