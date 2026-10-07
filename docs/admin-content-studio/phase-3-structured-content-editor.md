# Phase 3: core structured content editor

Status: implemented as an Admin-only authoring foundation. It is not a complete Projects, Courses, Practice, or Challenges authoring workflow and it has no publishing backend.

## Route and architecture

The editor is available at `/content/editor` in `apps/admin`. It is deliberately labeled **Content Studio Editor** and authors a minimal `COURSE`, `PRACTICE`, or `CHALLENGE` development envelope rather than pretending that a domain-specific workflow exists.

The implementation is split into:

- `blocks/`: canonical block definitions, palette, authoring canvas, and block operations.
- `inspector/`: schema-aware property controls and shared/language-variant editing.
- `state/`: a central immutable reducer with selection, dirty/save/validation state, and bounded undo/redo.
- `persistence/`: a replaceable `DraftRepository` abstraction, local development repository, and debounced autosave hook.
- `serialization/`: deterministic conversion to the Phase 2 canonical content envelope.
- `validation/`: shared-contract validation and issue-to-block mapping.
- `editor/`: composition, metadata, generated JSON view, shortcuts, recovery, and route-leave state.

The Phase 2 generic envelope schema now validates an optional canonical `content.blocks` array. There is no parallel Admin block model.

## Editing model

The desktop layout is palette, document canvas, and properties inspector. At tablet widths the palette and inspector become explicit drawers while the canvas remains primary. The mobile fallback uses a single-column metadata and toolbar layout without requiring drag and drop.

All 13 Phase 2 common blocks have authoring controls: heading, paragraph, list, code, callout, image, table, expected output, terminal command, divider, concept, requirements, and common mistakes. Authors can add by clicking a labeled palette button or dragging, reorder by drag or Move Up/Move Down, duplicate with a fresh collision-resistant ID, and delete with undo available. IDs survive content edits, reorder, serialization, and autosave.

Heading and paragraph shared text are directly editable in the canvas. Structural and complex values live in the inspector. Code uses a multiline plain-text textarea in this phase. This preserves whitespace, introduces no execution surface, avoids learner-runtime coupling, and avoids loading Monaco into the Admin foundation before a shared editor wrapper exists.

Variant-capable properties can switch between shared content and canonical language variants. Variant keys and required languages come only from the document's canonical compiler-language IDs.

## State, persistence, and navigation safety

The reducer owns the complete editable document, selected block, history, dirty status, save status, validation result, and active editor/JSON view. Mutations use cloned documents and preserve stable identity. Undo/redo is capped at 50 document snapshots and covers add, delete, reorder, property edits, and metadata edits. Global shortcuts deliberately yield to inputs, textareas, selects, and content-editable elements so native field undo remains intact.

Autosave is debounced by 650 ms. The UI depends on `DraftRepository`, not directly on browser storage. `LocalDraftRepository` provides namespaced local development recovery and can be replaced by a later authenticated draft service. A stale save completion cannot mark a newer edit saved, and recovery never overwrites an already-dirty document. Dirty documents install `beforeunload` protection and the Admin shell confirms internal route changes; saved documents do not prompt.

## Serialization, validation, and security

`serializeEditorDocument()` creates the canonical Phase 2 envelope with stable document identity, schema/version metadata, supported languages, and structured blocks. Generated JSON is deterministic, read-only, and secondary to normal authoring.

Validate calls the shared `validateContent()` contract. The panel presents structured severity, path, and message fields; selecting a mapped issue returns to the editor and selects its block. It does not run learner validators or code.

The editor accepts plain input and textarea values only. It provides no raw-HTML, style, CSS, script, arbitrary executable validator, URL, or runtime controls. Image authoring stores an asset ID rather than a URL. Terminal commands store an existing trusted command ID. Shared Phase 2 validation rejects raw HTML and unsafe contract shapes.

## Permissions and accessibility

`CONTENT_EDITOR`, `CONTENT_ADMIN`, and `SUPER_ADMIN` receive edit controls. `CONTENT_REVIEWER` receives the same document/JSON/validation surfaces in read-only mode. The existing Admin shell continues to reject users without `ADMIN_ACCESS`.

Palette buttons have explicit accessible names. Blocks are keyboard-focusable. Reorder, duplicate, and delete have labeled buttons; drag is never required. Inspector inputs are labeled, focus indicators use the Admin design language, save state is announced as a live status, and validation results are an announced region.

## Performance evidence

The focused test suite constructs and validates a synthetic 200-block document, checks deterministic ordering, and enforces a generous 1.5-second validation ceiling in the jsdom test environment. Canvas blocks are memoized and use stable block IDs as React keys. Generated JSON is memoized by document identity. This is a development smoke rather than a production browser benchmark; browser profiling with representative content remains appropriate before the later domain-specific authoring release.

## Known limitations

- Local draft recovery is development persistence, not a publishing or collaboration backend.
- The canvas is an authoring approximation, not the learner renderer or final preview.
- Table editing uses tab/newline structured text rather than a spreadsheet grid.
- Supported-language metadata is fixed on the development draft; a domain metadata editor belongs to a later phase.
- Native drag and drop is desktop-oriented. Mobile authoring uses the accessible click and reorder controls.
- No media upload, learner execution, validator execution, publishing, versioning, collaboration, or Project checkpoint/task workflow is included.
