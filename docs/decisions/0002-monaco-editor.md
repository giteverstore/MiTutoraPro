# ADR 0002: Monaco Editor for Interactive Code

- Status: Accepted
- Scope: Compiler workspace editor

## Context

Exercises require a credible desktop-editor experience: syntax highlighting, line numbers, indentation, bracket and quote completion, selection/navigation shortcuts, undo/redo, find, comments, and accessible keyboard focus. A textarea implementation would require rebuilding mature editor behavior and remained prone to keyboard-event conflicts.

## Alternatives

1. Styled textarea. Small bundle, but insufficient language behavior and accessibility for a production coding workflow.
2. CodeMirror. Capable and generally smaller, but would require a separate integration and design decision for the desired VS Code-like interaction model.
3. Monaco Editor. Larger bundle, but provides the expected desktop editing behavior and language infrastructure.
4. Embed a remote IDE. Powerful, but introduces backend/session dependencies and reduces control over exercise state.

## Decision

Use Monaco through `@monaco-editor/react`, configured in `MonacoCodeEditor.jsx`. Preserve native Monaco commands, use the MiTutora editor theme, and keep source controlled by `CompilerPanel`. Monaco mounts only in lessons that render a compiler workspace.

## Consequences

### Positive

- Familiar, robust keyboard and editing behavior.
- Extensible language tokenization and editor services.
- Less custom editor logic to maintain.
- Controlled value integrates with reset, execution, and validation flows.

### Negative

- Significant bundle size; Vite currently warns about the Monaco chunk.
- Worker configuration is required.
- Each added language may need tokenizer/configuration setup.
- Care is needed to prevent parent keyboard shortcuts from intercepting editor input.

### Follow-up

Keep execution independent from Monaco. Make the editor language dynamic before adding a second runtime, and monitor loading performance rather than masking chunk warnings.
