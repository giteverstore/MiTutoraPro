# Projects foundation

The Projects feature separates three concerns: a language-neutral project definition, reusable runtime definitions, and one replaceable active-project state per learner. This keeps the workspace and checkpoint engine independent of Python, JavaScript, Java, C++, or any future runtime.

## Project definitions and guides

Definitions live under `src/projects/catalog`. A project declares metadata, supported language IDs, checkpoints, a shared guide skeleton, optional language content, and narrowly scoped runtime overrides. CLI Task Manager is the first production project: one definition and five checkpoints shared across Python, JavaScript, Java, and C++.

Guide content is structured data rendered by `ProjectGuideRenderer`. Supported blocks include headings, paragraphs, notes, lists, code, expected output, runtime commands, language hints, and language-specific sections. Resolution follows shared content, dynamic runtime values, language-specific blocks, then a full section override when a project genuinely needs one. Authors should prefer shared concepts plus small hints.

## Runtime registry

`projectRuntimeRegistry` derives editor and execution metadata from the canonical compiler language registry, then adds project-facing defaults such as entrypoint, file extension, build command, run command, package manager, and starter files. `resolveProjectRuntime(project, languageId)` merges a project override onto the global runtime without copying the whole definition.

To add a language, first register it in the shared compiler registry, then add only missing project execution defaults. Add its ID to a project's `supportedLanguages` and optional `languageContent`/`languageOverrides`. Projects use the generic terms Runtime, Execution Environment, and Run.

## Active project state

`ProjectProgressService` stores one current state per project in the existing local persistence boundary. State includes project/language identity, active or completed status, current and completed checkpoints, guide/workspace state, timestamps, validation evidence, and files. Changing language explicitly replaces this state; version 1 does not retain attempts or language history.

The listing reports checkpoint counts rather than invented percentages. Start opens language selection and a reset warning. Checkpoints may be read out of order, but validation is sequential. `run_or_terminal` permits Run or the configured command; `terminal_only` keeps Run visible but disabled. Both paths call the same validation boundary.

## Workspace and reuse

The Projects workspace reuses Monaco, compiler manager/runtime execution, shared dialogs, theme tokens, subscription access checks, model lifecycle support, keyboard-accessible tabs, and existing resizable panels. It adds checkpoint navigation, structured guide rendering, runtime-aware starter files, a collapsible terminal, project settings, and completion/export UI. Legacy easy projects continue through their existing Python validation/export path.

`ProjectExporter.createWorkspaceArchive` packages the learner's files plus a minimal README. It deliberately excludes progress, validation, and Y Coders metadata. The workspace model remains file-oriented so a later Git adapter can initialize a repository, connect a remote, and commit without changing project definitions. Git and GitHub integration are out of scope now.

## Contextual Ask AI boundary

`ProjectContextualAI`, `ProjectAIClient`, and `createProjectAIContext` implement a selection-driven mentor over the existing authenticated AI Tutor endpoint. There is no free-form composer or permanent question list. Selecting supported content starts a new local branch; the first model operation returns 3–6 structured contextual question/action options. Selecting an option starts the second operation, which returns a concise hint-first answer and up to five structured follow-ups. Changing the selection clears the branch, and no permanent AI history is stored.

Supported selection types and transmitted data are deliberately explicit:

- `guide_text`: selected text, bounded surrounding guide context, project/checkpoint metadata, language, difficulty, objectives, and checkpoint requirements.
- `guide_code`: the same metadata plus the selected guide snippet and nearby explanation.
- `user_code`: selected code plus a bounded window of the current file (12,000 characters maximum), its relative path, and current checkpoint context.
- `terminal_output`: selected output, a bounded recent output window (6,000 characters), stream, last configured run command, execution status, and—when available—a bounded current-file snapshot.

The client never adds unrelated files, the complete workspace, terminal history, profile/account data, another project, or project history. The server independently validates total request size, field sizes, selection type, project/checkpoint metadata, and structured provider output. Learner text is labelled as untrusted data in provider prompts.

Projects reuse `/api/ai/explain`, Firebase authentication, the canonical Premium guard, rollout feature gate, Firestore quota reservation/settlement, provider selection, provider timeouts/cancellation, and public error sanitization. Provider/model configuration remains outside Projects UI. The provider receives a strict JSON schema: question generation returns `{ operation, questions[] }`; answers return `{ operation, answer, followUps[] }`. Malformed responses never reach the UI.

The system prompt keeps explanations within the active checkpoint and adapts terminology to project difficulty and language. Initial debugging help is hint-first: identify the area, explain the concept, and suggest an inspection before supplying corrections. Follow-ups may request increasingly specific help, but the mentor does not gain access to absent repository context.

## Adding a project

1. Add one normalized definition with metadata, learning outcomes, prerequisites, supported language IDs, and ordered checkpoints.
2. Author one structured guide skeleton; add language hints or overrides only where syntax/runtime differences require them.
3. Reference runtime commands rather than duplicating command strings in prose.
4. Provide checkpoint requirements, execution mode, expected output or validation reference, and completion text.
5. Add fixture tests for runtime resolution, guide rendering, progress reset, sequential completion, and export contents.

## Production example: CLI Task Manager

`cliTaskManagerProject.js` demonstrates the intended authoring pattern. Shared checkpoint prose teaches modeling, operations, serialization, and CLI control flow without prescribing a class or filename. `languageContent` supplies focused fragments such as `taskModelHint`, `taskModelCode`, `inputCode`, and `persistenceCode`. The renderer resolves those keys for the active runtime, so the guide remains one skeleton rather than four tutorials.

The project uses the canonical runtime defaults for `python main.py`, `java Main`, and `./app`, with a narrow JavaScript override for `node index.js`. Each runtime owns its minimal entrypoint starter. Java keeps the task type nested in `Main.java` because the current browser execution boundary accepts one source file; that is a runtime constraint, not a UI special case.

Every checkpoint declares `project-checks` validation. `execution` checks run learner code with controlled stdin and verify meaningful output. `source_matches` checks capture implementation-independent evidence such as a title/completion representation or save/load behavior, with language-specific patterns held in content configuration. Hidden checks return only pass/fail evidence. This validator vocabulary is reusable by future projects and is intentionally independent of Task Manager filenames or function names.

The five checkpoints alternate `run_or_terminal` and intentional `terminal_only` modes. The final checklist covers startup, the complete menu, add/list/complete/delete operations, persistence evidence, invalid-input handling, and clean exit. Completion still requires sequential checkpoint validation.

## Virtual project filesystem

`ProjectExecutionService` is the runtime-neutral execution boundary. A request contains the project and language IDs, the complete normalized file snapshot, entrypoint, commands, stdin, timeout, and execution metadata. It mounts that snapshot through the existing compiler manager and returns normal execution evidence plus a filtered resulting snapshot and explicit created, modified, and deleted mutations.

Files use safe relative POSIX-style paths and UTF-8 text content. The boundary rejects absolute paths, traversal, empty segments, NUL bytes, excessive file counts, and oversized files/workspaces. Every run starts from the supplied snapshot, so projects and users cannot inherit another execution's writable state. The editor workspace remains authoritative: runtime changes are applied relative to the mounted baseline, while unrelated edits made during a run are retained deterministically.

Runtime adapters own filesystem differences. Python mounts an isolated `/project` tree in Pyodide and reads it back. JavaScript supplies a confined project-only CommonJS loader and `fs` facade. C/C++ mount the complete workspace into the WASI directory and snapshot it afterward. Java compiles all supplied `.java` sources, but TeaVM does not expose a writable host filesystem bridge, so mutation capture and automated restart persistence are explicitly unsupported there. Capabilities are declared in runtime metadata rather than spread through project UI code.

Runtime-created learner files such as `tasks.json` become normal workspace files and are available to the next run and ZIP export. Compiler products and caches (`.class`, object/WASM files, binaries, source maps, `__pycache__`, and temporary/cache directories) are removed at the capture/export boundary. The CLI Task Manager persistence checkpoint executes twice against one evolving snapshot: the first run must create its persistence file and the second must load the saved task. Java reports those automated filesystem checks as not applicable instead of manufacturing a pass.

## Current limitations

- Active state supports one cloud-backed attempt per authenticated learner and project, with local storage retained only as an optimistic/recovery cache.
- No project history, synchronization, Git, GitHub, arbitrary shell, or production-scale catalogue is included.
- The terminal accepts the configured project run command; it is not a general host shell.
- Java/TeaVM supports multi-source compilation but does not currently expose runtime filesystem mutations, so Java persistence retains source-level evidence and clearly marked not-applicable automated filesystem checks.
- The virtual filesystem is a bounded UTF-8 project workspace, not a general host filesystem, package manager, or shell.
- Contextual AI is selection-scoped and online-only. It does not index the workspace, retain conversation history, or automatically include sibling files. Provider answers may be incorrect and remain subject to the existing AI Tutor rollout and quota configuration.

## V1 production boundary

Projects V1 deliberately covers the catalogue, overview/start flow, one active attempt per learner and project, the bounded virtual filesystem, checkpoint validation, contextual AI, cloud recovery, and ZIP export. The production catalogue contains the CLI Task Manager and the second language-agnostic project fixture used to verify that the platform is not coupled to one project shape. Git/GitHub, attempt history, portfolio/public sharing, repository-wide or permanent AI, collaborative editing, server-side multi-peer labs, P2P File Sharing, additional production projects, and a major Java filesystem bridge are explicitly deferred.

Runtime capability is honest and data-driven. Python, JavaScript, and C/C++ can capture supported runtime file mutations into the bounded learner workspace. Java supports multiple source files but its TeaVM boundary cannot capture writable runtime filesystem changes; persistence checks that require that capability are reported as not applicable rather than passed. The terminal accepts only the configured project commands and never exposes a host shell.

Validation is sequential and combines public learner-facing evidence with protected pass/fail checks. Public failures explain the unmet behavior without exposing hidden test implementation. Run, terminal execution, and checkpoint validation share the same compiler and isolation boundaries. The project workspace enforces normalized relative paths, file-count and byte ceilings, filtered build artifacts, bounded output, execution timeouts, and per-run snapshots.

ZIP export waits for pending cloud persistence and packages the current normalized learner snapshot plus a minimal README. Nested, learner-created, and captured runtime files are included; progress records, validation internals, AI state, compiler artifacts, and application metadata are excluded. Export failures remain in the workspace as actionable learner-facing errors.

Accessibility support includes semantic tabs and headings, keyboard-operable splitters and tab lists, labelled editor/terminal controls, focus-managed shared dialogs, visible focus styles, a textual explanation for terminal-only disabled Run controls, and text in addition to icons/color for checkpoint and validation state. Narrow layouts collapse the workspace to one primary panel plus existing drawers/tabs rather than preserving an unusable multi-column IDE.

The security boundary is layered: Firestore rules enforce UID ownership and record shape; the client namespaces recovery cache data by authenticated UID; revision transactions reject stale writes; virtual paths reject traversal and absolute paths; runtime snapshots are bounded and normalized; contextual AI receives only the learner-selected bounded context described above; and public errors are sanitized. Worker/WASM isolation is a resource and capability boundary, not a hardened hostile-code sandbox.

## Active-project cloud persistence

Authenticated Projects use `ProjectProgressService` as the UI boundary and `ActiveProjectRepository` as the Firebase provider. React owns the live editor state, local storage is an optimistic/recovery cache, and Firestore is the durable source of truth. The Projects screen completes cloud hydration before mounting a workspace, preventing starter state from overwriting a saved workspace.

Authenticated local recovery keys are namespaced by Firebase UID. A legacy unscoped V1 cache is migrated once to the first authenticated learner that opens Projects and then removed; it is never exposed to a later account on the same browser. Switching accounts cancels pending save generations, clears revision/save-status state, and ignores an older account's in-flight completion.

Each learner has one metadata document at `users/{uid}/activeProjects/{projectId}` and a `files` subcollection. Metadata contains schema version 1, language, status, checkpoint state, folders, entry file, revision, and lifecycle timestamps. Each normalized UTF-8 workspace file is stored separately so the existing 2 MiB workspace ceiling is not forced into Firestore's single-document limit. Runtime/build artifacts continue to be removed by `normalizeProjectFileSnapshot`; learner files such as `tasks.json`, nested files, and deletions are represented by the complete normalized snapshot.

Editor changes update the local recovery cache immediately and schedule one cloud save after 900 ms of inactivity. Checkpoint completion, successful validation, runtime filesystem mutations, language reset, and workspace exit request an immediate save. “Saved” is shown only after repository confirmation; failures remain cached locally and are shown as stale-cloud errors.

Cloud writes use an optimistic revision transaction (`N` to `N + 1`). A stale tab/device receives a conflict instead of replacing newer cloud data. Language reset cancels the prior generation before replacing the active record, so an old-language debounce cannot restore deleted state. This is conflict detection, not collaborative merging; the current recovery path is to reload the newer cloud copy.

On first authenticated hydration, a local active record is uploaded only when no cloud record exists. An existing cloud record always wins. Schema versions other than 1 are rejected at the repository migration boundary rather than silently reset. Firestore rules restrict metadata and file access to the authenticated UID, constrain document shape, revisions, file count metadata, path length, and individual file content size. Premium access remains controlled by the existing Projects gate; persistence neither grants access nor deletes saved work when entitlement changes.
- Existing subscription preview boundaries remain unchanged.

### Authenticated browser acceptance

`tests/e2e/projects-cloud-persistence.spec.js` exercises the real Projects UI with Playwright against the Firebase Auth and Firestore emulators. Its fixture creates a unique learner per test through the Auth emulator, seeds only the minimum Premium subscription and entitlement documents through the emulator Admin SDK, then signs in through the normal browser login flow. Test cleanup relies on the repository's isolated emulator lifecycle; no shared production identity or cloud project is used.

The Chromium acceptance covers editor autosave, direct Firestore metadata and file assertions, checkpoint persistence, reload hydration, cloud-over-stale-local precedence, one-time local migration, visible save/conflict state, and stale revision rejection. Python and C++ additionally create writable runtime files, persist those files to Firestore, reload the workspace, and prove a second execution reads the restored file. The C++ scenario permits one cold toolchain warm-up attempt while retaining the unchanged 10-second learner execution limit for the asserted run.

Run the focused suite with:

```powershell
npx.cmd playwright test tests/e2e/projects-cloud-persistence.spec.js --project=chromium
```

The browser must be able to load the pinned Pyodide asset used by the real Python worker. Native compiler assets are served from the local preview build. Java is intentionally not represented as writable-runtime persistence coverage because TeaVM does not expose runtime filesystem mutation capture; no Java persistence result is faked. JavaScript remains suitable for later optional expansion but is not required by this acceptance gate.
