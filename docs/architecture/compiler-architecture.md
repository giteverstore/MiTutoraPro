# Compiler Architecture

The compiler is a set of language-neutral orchestration contracts with a browser Python implementation. React UI code depends on `CompilerManager`, not Pyodide.

## Layers

```text
CompilerPanel (React)
  → CompilerManager
    ├── RuntimeRegistry → RuntimeAdapter implementation
    └── ValidatorRegistry → OutputValidator implementation
```

- `CompilerProvider` supplies one manager instance to React.
- `normalizeCompilerDefinition` converts canonical and legacy JSON into one internal definition.
- `CompilerPanel` owns editor text and presentation state for the mounted lesson.
- `CompilerManager` initializes runtimes once, executes current source, formats optionally, resets, validates output, and disposes runtimes.
- registries map stable content IDs to implementations.

## Execution request

`CompilerManager.execute` receives:

```js
{
  language,
  source,
  stdin,
  inputs,   // compatibility alias
  filename,
  signal
}
```

The result contract used by the UI is:

```js
{
  status: 'success' | 'error',
  output: string,
  errors: string[],
  executionTimeMs: number
}
```

The panel stores current editor content both in React state and a ref. Runs use the ref, preventing stale closures from executing starter code. Starting a run aborts the previous request.

## Output verification

Execution and verification are separate actions. A successful run does not complete an exercise. `Check Output` asks the registered validator to compare `expectedOutput` and the runtime’s program output. A match persists verification; the learner must still press `Mark Complete`.

The default normalized validator:

- normalizes CRLF/CR to LF;
- trims leading and trailing whitespace;
- collapses all whitespace runs to one space;
- preserves token order.

## Lifecycle and lazy behavior

Monaco is loaded through the compiler editor component, and Python runtime initialization occurs only after a compiler execution path calls `CompilerManager.initialize`. Python executes in a dedicated worker. `CompilerProvider` disposes the manager on unmount.

## Compatibility

The canonical compiler fields are `language`, `starterCode`, `stdin`, `expectedOutput`, and validator type. `normalizeCompilerDefinition` also accepts legacy `files`, `activeFile`, `inputs`, and `validation` fields so the existing Python course remains valid.
