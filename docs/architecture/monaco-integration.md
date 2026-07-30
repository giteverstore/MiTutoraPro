# Monaco Integration

`src/components/MonacoCodeEditor.jsx` integrates Monaco through `@monaco-editor/react`.

## Loading and workers

The module configures Monaco’s editor worker through Vite’s `?worker` import. It supplies the local Monaco instance to the React loader and registers Python’s language configuration and Monarch tokenizer when needed.

The editor is only part of the compiler component tree, so lessons without compiler blocks do not mount it. Vite produces a separate Monaco chunk, although that chunk is currently large enough to trigger a build warning.

## Editor behavior

Current options include:

- automatic layout and responsive height
- line numbers
- four-space indentation
- Tab insertion and Shift+Tab outdent
- auto-closing quotes and brackets
- bracket matching and pair colorization
- smooth scrolling and caret animation
- wrapped long lines
- selected-whitespace rendering
- no minimap and no scrolling beyond the last line

The MiTutora editor theme is defined in the integration module and uses the existing dark IDE visual language.

## Keyboard handling

Monaco retains native editing and navigation shortcuts. The editor shell stops bubbling keydown events so parent application shortcut handlers do not intercept Monaco commands. Ctrl/Cmd+Enter dispatches `learning-platform:run`, which the visible compiler panel handles.

On mount, the editor focuses only when its DOM bounds are visible. Do not force focus for hidden/mobile duplicate panels.

## Data contract

The editor is controlled through `value` and `onChange`. `CompilerPanel` owns the source of truth and updates a ref synchronously so execution always receives the latest text.

When adding language support, register its Monaco language assets or use a built-in language ID; do not put runtime execution logic in this component.
