# Compiler Architecture

The compiler is a set of language-neutral orchestration contracts with browser Python and Java implementations. React UI code depends on `CompilerManager`, not Pyodide or TeaVM.

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
  execution,
  timeoutMs,
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

Two generic validators cover outputs whose source semantics are not exact text: `numeric_tolerance` compares ordered numeric values within a configured tolerance, and `integer_range` accepts one integer within configured bounds. Java Basics uses these for the cube-root precision example and random-number exercise respectively; the displayed source examples remain unchanged.

`CompilerManager.executeTests` applies this contract to public test cases and validates every returned result. Protected tests remain server-side and are never passed to browser runtimes.

## Lifecycle and lazy behavior

Monaco is loaded through the compiler editor component. A runtime is instantiated and initialized only after its language reaches `CompilerManager.initialize`. Python and Java execute in separate workers; opening or running Python does not load Java assets. A Java worker reuses its compiler instance until cancellation, timeout, disposal, or a fatal worker error. `CompilerProvider` disposes the manager on unmount.

## Java adapter

`JavaRuntime` uses the open-source [TeaVM browser compiler](https://github.com/konsoletyper/teavm-javac), combining an OpenJDK-based javac with TeaVM WebAssembly generation. Compiler, SDK, class-library, and loader artifacts are self-hosted under `public/vendor/teavm-javac` and fetched only by the Java worker.

The integration targets the current TeaVM distribution and its Java 17-compatible source compiler; the runtime test suite includes a Java record. Compatibility is still bounded by TeaVM's browser class library rather than a complete desktop JDK.

Two execution modes are supported:

- `program`: compile learner source and invoke the configured `mainClass` through an internal runner.
- `method`: compile a configured class and invoke one method with JSON-compatible scalar or consistently typed array arguments.

The runner is internal and never shown in Monaco. It supplies stdin and routes stdout, stderr, compilation failures, and runtime failures into the standard result. Java Basics uses program mode. A small Scanner compatibility shim implements the `nextInt`, `nextDouble`, and `nextLine` patterns used by the course because the TeaVM browser class library does not expose `java.util.Scanner`.

Cancellation and timeout terminate the Java worker. A later run creates a fresh worker and initializes a new compiler lazily.

## Browser security boundary

Generated code runs in a WebAssembly worker under the browser sandbox, not an OS process. The worker receives no DOM reference or Mi Tutora service credentials. This is not an authoritative judge: CPU and memory exhaustion remain possible until worker termination, generated code shares the worker's browser origin, and public expected outputs/tests are observable. Protected tests and certification decisions must remain on a future isolated server-side judge.

## Licensing

The TeaVM browser compiler is Apache-2.0 and documents its OpenJDK components as GPLv2 with the Classpath Exception. Vendored assets originate from the official TeaVM playground and their hashes should be reviewed during upgrades. CheerpJ was evaluated but not selected because its documented application flow consumes precompiled JARs while lessons require source compilation, and its [licensing documentation](https://cheerpj.com/docs/licensing) requires an appropriate commercial agreement for organizational production use outside technical evaluation.

## Compatibility

The canonical compiler fields are `language`, `starterCode`, `stdin`, `expectedOutput`, and validator type. Optional `execution`, `timeoutMs`, and public `testCases` extend the shape without changing Python content. `normalizeCompilerDefinition` also accepts legacy `files`, `activeFile`, `inputs`, and `validation` fields so the existing Python course remains valid.
