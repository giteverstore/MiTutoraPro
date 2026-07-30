# Adding a Language

Adding a language requires an editor language ID, runtime adapter, registration, and course content. The Learning Engine should not change.

## 1. Define the language

Create `src/compiler/languages/<language>.js` with a stable lowercase ID and a runtime factory. Use the same ID in course compiler blocks.

## 2. Implement the runtime

Create `src/compiler/runtimes/<language>/` and extend `RuntimeAdapter`:

```js
export class JavaScriptRuntime extends RuntimeAdapter {
  async initialize(options) {}
  async execute({ source, stdin, filename, signal }) {
    return {
      status: 'success',
      output: '',
      errors: [],
      executionTimeMs: 0
    };
  }
  async reset() {}
  async dispose() {}
}
```

Execute current `source`, honor cancellation, capture stdout/stderr separately, measure execution time, and release all resources. Never import React or read lesson/progress state.

## 3. Register it

Register the factory in `src/compiler/createCompilerManager.js`:

```js
runtimeRegistry.register(language.id, language.createRuntime);
```

`RuntimeRegistry` lowercases IDs and lazily creates one instance per language.

## 4. Configure Monaco

Make `MonacoCodeEditor` accept the compiler language instead of assuming Python if the language is not already dynamic. Register the relevant Monaco tokenizer/configuration or use a built-in language. Add filename defaults in `normalizeCompilerDefinition`.

This is an existing Python-specific UI seam: runtime architecture is language-neutral, but the current editor passes `language="python"`.

## 5. Author compiler content

Use:

```json
{
  "type": "compiler",
  "language": "javascript",
  "starterCode": "console.log('Hello');",
  "stdin": "",
  "expectedOutput": "Hello",
  "validator": "normalized"
}
```

Update the schema’s allowed validator values only when introducing a new validator. The language field itself is a non-empty string.

## 6. Verify

Test first initialization, repeated runs, current-editor execution, stdin, stdout, stderr, syntax/runtime errors, reset, abort, disposal, output match/mismatch, responsive layout, and lessons without compiler blocks. Confirm the runtime/editor assets remain lazy enough for non-compiler lessons.
