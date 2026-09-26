import { RuntimeAdapter } from '../../core/RuntimeAdapter.js';
import { JavaScriptRuntime } from '../javascript/JavaScriptRuntime.js';

function formatDiagnostics(ts, diagnostics, filename) {
  return diagnostics.map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    if (!diagnostic.file || diagnostic.start == null) return `TypeScript: ${message}`;
    const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `${filename}:${position.line + 1}:${position.character + 1} - ${message}`;
  }).join('\n');
}

export class TypeScriptRuntime extends RuntimeAdapter {
  constructor({ javascriptRuntime = new JavaScriptRuntime() } = {}) {
    super();
    this.javascriptRuntime = javascriptRuntime;
    this.typescript = null;
  }

  async initialize(options) {
    const module = await import('typescript');
    this.typescript = module.default ?? module;
    await this.javascriptRuntime.initialize(options);
  }

  async execute(request) {
    if (!this.typescript) await this.initialize({ signal: request.signal });
    const ts = this.typescript;
    const filename = request.filename ?? 'main.ts';
    const transpiled = ts.transpileModule(request.source, {
      fileName: filename,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.None,
        strict: true,
      },
    });
    const diagnostics = transpiled.diagnostics?.filter(({ category }) => category === ts.DiagnosticCategory.Error) ?? [];
    if (diagnostics.length) {
      return { status: 'error', output: '', errors: [formatDiagnostics(ts, diagnostics, filename)], executionTimeMs: 0 };
    }
    return this.javascriptRuntime.execute({ ...request, source: transpiled.outputText, filename: filename.replace(/\.tsx?$/i, '.js') });
  }

  async reset() { return this.javascriptRuntime.reset(); }
  async dispose() { return this.javascriptRuntime.dispose(); }
}
