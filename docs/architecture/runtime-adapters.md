# Runtime Adapters

`RuntimeAdapter` is the language execution boundary consumed by `CompilerManager`. Runtime implementations are plain JavaScript services and must not depend on React, lesson components, or progress state.

## Interface

Defined in `src/compiler/core/RuntimeAdapter.js`:

- `initialize(options)`: prepare the runtime; safe to await repeatedly through the manager.
- `execute(request)`: execute current source and return the standard result.
- `format(source, options)`: optional source formatter; default returns source unchanged.
- `reset()`: clear runtime state and return an idle result.
- `dispose()`: release workers, processes, proxies, or other resources.

`execute` must honor `AbortSignal` where possible and must never substitute expected output for actual program output.

## Registration

`RuntimeRegistry` normalizes language IDs to lowercase. It stores factories and creates one runtime instance per registered ID on first resolution. `createCompilerManager.js` is the composition root:

```js
runtimeRegistry.register('python', () => new PythonRuntime());
runtimeRegistry.register('java', () => new JavaRuntime());
```

Language metadata belongs under `src/compiler/languages/`; implementation code belongs under `src/compiler/runtimes/<language>/`.

## Initialization

`CompilerManager` caches initialization promises per runtime. Failed initialization removes the cached promise so a later attempt can retry. Registry disposal calls every instantiated runtime’s `dispose` and clears the instance cache.

## Error behavior

An unregistered language produces an error result from `execute`. Validator lookup failures throw because they represent an invalid application/content configuration. Runtime adapters should convert language/runtime failures into the standard result when execution has begun, while initialization failures may reject.

Python uses Pyodide in `python.worker.js`. Java uses the TeaVM javac/WebAssembly pipeline in `java.worker.js`. Both preserve the same manager-facing lifecycle and normalized result contract; React imports neither runtime directly.

For the complete extension workflow, see [Adding a language](../development/adding-a-language.md).
