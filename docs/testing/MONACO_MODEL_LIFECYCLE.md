# Monaco model lifecycle

## Shared editor ownership

`MonacoCodeEditor` owns the editor instance created by `@monaco-editor/react`. The wrapper disposes the active model and editor on ordinary unmount. YCoders additionally owns all URI-backed models in an explicitly supplied model scope.

Language definitions and themes are configured once per Monaco API instance. Editor-specific cursor, focus, blur, key, action, widget, content-change, marker, and layout resources are disposed with the editor. The delayed focus animation frame is cancelled if disposal wins the race. Monaco's shared editor Worker is a process-level cache; reuse is expected, while unbounded Worker creation is not.

## Surface policy

| Surface | Model identity | Retention | Disposal point |
| --- | --- | --- | --- |
| Standalone compiler | Anonymous active editor model | Current mounted language page only | Page/editor unmount |
| Course compiler | Anonymous active editor model | Current mounted compiler only | Compiler unmount |
| Practice | Anonymous active editor model | Current mounted question only | Question/compiler unmount |
| Challenges | Anonymous active editor model | Current mounted challenge only | Challenge/compiler unmount |
| Project Workspace | `ycoders-project://<encoded-project-id>/<encoded-file-path>` | One model per currently open tab, preserving dirty text and undo/redo while switching tabs | Tab close, file delete/rename, project switch, or workspace unmount |

Project scopes cannot collide because the project ID is part of every URI. File segments are encoded. Rename creates the new URI and removes the old URI; delete/close removes the no-longer-retained URI; switching projects releases the entire old prefix. Closing all tabs leaves no project model.

## Validation contract

The Chromium lifecycle harness opens 50 project files, collapses retention to one open file, renames it, switches projects 20 times, performs 20 project route cycles, changes language 30 times, and performs 50 standalone/compiler edit-reset-unmount cycles. Model counts must be respectively 50, 1, 1, 1, 1, and 0 after final unmount. Worker count must remain bounded. Forced GC and heap measurements are diagnostic; model counts are the authoritative deterministic signal.
