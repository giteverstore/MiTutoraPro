import { createJavaRunnerSource, formatJavaDiagnostics, injectJavaStdin, JAVA_SCANNER_COMPAT_SOURCE } from './javaExecution.js';

const ASSET_ROOT = '/vendor/teavm-javac';

const defaultLoadAsset = async (name) => {
  const response = await fetch(`${ASSET_ROOT}/${name}`);
  if (!response.ok) throw new Error(`Java runtime asset ${name} could not be loaded (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
};

const defaultLoadRuntimeModule = () => import(/* @vite-ignore */ `${ASSET_ROOT}/compiler.wasm-runtime.js`);

export class TeaVMJavaEngine {
  constructor({ loadAsset = defaultLoadAsset, loadRuntimeModule = defaultLoadRuntimeModule } = {}) {
    this.loadAsset = loadAsset;
    this.loadRuntimeModule = loadRuntimeModule;
    this.compilerWasm = null;
    this.sdk = null;
    this.classlib = null;
    this.load = null;
  }

  async initialize() {
    if (this.compilerWasm) return;
    const [runtimeModule, compilerWasm, sdk, classlib] = await Promise.all([
      this.loadRuntimeModule(),
      this.loadAsset('compiler.wasm'),
      this.loadAsset('compile-classlib-teavm.bin'),
      this.loadAsset('runtime-classlib-teavm.bin'),
    ]);
    this.load = runtimeModule.load;
    this.compilerWasm = compilerWasm;
    this.sdk = sdk;
    this.classlib = classlib;
  }

  async execute({ source, stdin = '', filename = 'Main.java', execution = {} }) {
    await this.initialize();
    // TeaVM compiler sessions retain generated-program state. Instantiate the
    // compiler module from cached bytes per run while reusing downloaded assets.
    const compilerRuntime = await this.load(this.compilerWasm);
    const compiler = compilerRuntime.exports.createCompiler();
    compiler.setSdk(new Uint8Array(this.sdk));
    compiler.setTeaVMClasslib(new Uint8Array(this.classlib));
    const diagnostics = [];
    const registration = compiler.onDiagnostic((diagnostic) => diagnostics.push({
      type: diagnostic.type,
      severity: diagnostic.severity,
      fileName: diagnostic.fileName,
      lineNumber: diagnostic.lineNumber,
      columnNumber: diagnostic.columnNumber,
      message: diagnostic.message,
    }));
    const stdout = [];
    const stderr = [];

    try {
      compiler.addSourceFile(filename, injectJavaStdin(source, stdin));
      compiler.addSourceFile('MiTutoraRunner.java', createJavaRunnerSource({ stdin, execution }));
      compiler.addSourceFile('MiTutoraScanner.java', JAVA_SCANNER_COMPAT_SOURCE);
      if (!compiler.compile()) {
        return { status: 'error', stdout: '', stderr: formatJavaDiagnostics(diagnostics) || 'Java compilation failed.' };
      }
      if (!compiler.generateWebAssembly({ outputName: 'app', mainClass: 'MiTutoraRunner' })) {
        return { status: 'error', stdout: '', stderr: formatJavaDiagnostics(diagnostics) || 'Java bytecode could not be prepared for execution.' };
      }
      const generatedWasm = compiler.getWebAssemblyOutputFile('app.wasm');
      let flushOutput = () => {};
      const runtime = await this.load(generatedWasm, {
        installImports(imports) {
          let standardOutput = '';
          let standardError = '';
          imports.teavmConsole = {
            putcharStdout(character) {
              if (character === 10) { stdout.push(standardOutput); standardOutput = ''; }
              else standardOutput += String.fromCharCode(character);
            },
            putcharStderr(character) {
              if (character === 10) { stderr.push(standardError); standardError = ''; }
              else standardError += String.fromCharCode(character);
            },
          };
          imports.miTutoraOutput = {
            flush() {
              if (standardOutput) stdout.push(standardOutput);
              if (standardError) stderr.push(standardError);
              standardOutput = '';
              standardError = '';
            },
          };
          flushOutput = imports.miTutoraOutput.flush;
        },
      });
      runtime.exports.main([]);
      flushOutput();
      return { status: 'success', stdout: stdout.join('\n'), stderr: stderr.join('\n') };
    } catch (error) {
      return {
        status: 'error',
        stdout: stdout.join('\n'),
        stderr: [stderr.join('\n'), error instanceof Error ? error.message : String(error)].filter(Boolean).join('\n'),
      };
    } finally {
      if (typeof registration === 'function') registration();
      else registration?.destroy?.();
    }
  }

  reset() {
    // Each execution uses a fresh compiler session; runtime assets remain cached.
  }

  dispose() {
    this.reset();
    this.compilerWasm = null;
    this.sdk = null;
    this.classlib = null;
    this.load = null;
  }
}
