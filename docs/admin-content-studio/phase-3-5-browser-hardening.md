# Phase 3.5: Content Studio visual and browser hardening

Status: implemented and verified in Chromium at 1440×900, 760×820, and 390×844. This phase adds no authoring domain, block type, backend, publishing, learner-preview, runtime, or AI capability.

## Defects found and corrected

- The Admin development CSP blocked Vite's inline React Refresh preamble. The local-only policy now permits inline development scripts; the production policy remains unchanged and forbids both `unsafe-inline` and `unsafe-eval`.
- Ajv attempted runtime schema compilation through `new Function`, which the production Admin CSP correctly blocked. Canonical validators are now generated ahead of time by `scripts/generate-content-validators.mjs`; the browser consumes CSP-safe standalone validation functions without relaxing production policy.
- Palette, canvas, and inspector scrolling previously fell through to the page. The desktop workspace now has a bounded authoring viewport with independent, overscroll-contained panel scrolling and sticky panel headers.
- Both responsive drawers could be open simultaneously, and visually hidden drawers remained keyboard-focusable. Compact panels are now conditionally hidden from layout/accessibility navigation, mutually exclusive, linked by `aria-controls`, and dismissible with Escape.
- Drag targets had no insertion feedback, and dropping the first palette block on the empty-canvas content did not insert it. Block targets now show a blue insertion marker and canvas drop handling accepts the initial block without creating bubbled duplicates.
- Lists could only be edited in the inspector despite being a prose-oriented block. List items now support direct labeled editing in the canvas.
- Selection was visual only. The selected authoring block now exposes `aria-current="true"` while retaining its visible border/ring.
- Long code, tables, asset identifiers, and terminal content could widen the page. Overflow is now local to the relevant authoring surface and long text wraps where semantic whitespace is not required.
- Local recovery used a newly generated document ID after every refresh, so a saved draft could not be rediscovered. `LocalDraftRepository` now records a namespaced active-document pointer while preserving per-document keys and the repository abstraction.
- Raw one-of branch output could produce dozens of irrelevant Ajv errors for one invalid block. Editor validation now filters branch noise, deduplicates issues, and retains the actionable property issue mapped to the stable block ID.

## Browser coverage

The dedicated Admin-only Playwright configuration and harness are under `apps/admin/tests/browser`. They do not alter or reuse the learner Playwright application setup.

Automated Chromium scenarios cover:

- desktop click and drag insertion, heading/paragraph/list editing, code variants, reorder, duplicate, delete, keyboard undo/redo, validation, generated JSON, autosave, refresh recovery, and horizontal-overflow checks;
- invalid-field validation, issue activation, stable selected-block mapping, correction, and revalidation;
- tablet exclusive palette/inspector drawers, editing, Escape dismissal, and overflow;
- a 390 px mobile non-drag authoring fallback;
- reviewer read-only enforcement with validation and JSON access;
- a synthetic 200-block render, deep selection, validation, and generated JSON smoke.

The browser server uses an isolated test-only Admin entry and deterministic teardown. It does not add an authentication bypass to the production entrypoint.

## Remaining limitations

- Native HTML drag/drop remains a desktop enhancement; mobile uses the supported click and reorder controls.
- Browser timings are smoke thresholds rather than statistically sampled performance benchmarks.
- Code remains a textarea by the deliberate Phase 3 decision; no learner editor/runtime wrapper is loaded.
- The Admin application remains single-theme, so no new theme system was introduced.
