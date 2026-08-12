# Easy Project Engine

The Easy Project Engine is a content-driven, browser-only system for implementing one controlled function, validating it, and exporting a reusable repository. It lives under `src/projects` and remains independent from the Learning Engine and certification trust.

## Architecture

- `catalog/` contains project definition data.
- `models/` validates the common definition contract.
- `repositories/ProjectCatalog` provides framework-independent lookup and filters.
- `validation/ProjectValidator` runs controlled function tests through the existing `CompilerManager` and Python runtime.
- `services/ProjectProgressService` records started state, attempts, validation result, completion time, and score locally.
- `export/ProjectExporter` creates a ZIP locally with the learner implementation, README, public tests, requirements file, and `.gitignore`.
- `components/` and `pages/` render the same catalog, details, workspace, results, and completion experience for every definition.

## Definition contract

Each definition supplies identity and discovery metadata, skills and objectives, learner instructions and requirements, starter code, a function contract, deterministic validation cases, output template paths, and an export repository name. Validation cases can be learner-visible or protected. Protected inputs and expected results are never displayed or exported.

Easy projects currently support Python function implementations. `difficulty`, validation `type`, template paths, and function metadata remain explicit so later multi-file Intermediate and repository-based Advanced engines can introduce their own validators and workspaces without changing Easy definitions.

## Validation lifecycle

The workspace passes the learner source to `ProjectValidator`. It appends a controlled Python harness, executes through `CompilerManager`, and returns `{ passed, tests, score, errors }`. Protected cases return only their name and pass/fail state to the UI. Completion is recorded only when every required case passes. No submitted code is sent to Firebase or executed by a server.

Because validation runs in the learner's browser, protected cases are an instructional concealment mechanism rather than a security boundary. They are excluded from the generated repository, but a determined learner can inspect downloaded application code. Server-authoritative assessment is intentionally outside the Easy Project scope.

## Export lifecycle

After successful validation, `ProjectExporter` inserts the current implementation into the configured source path and generates the archive with JSZip. Export occurs locally; the platform uploads neither source nor archives. Internal validation cases, answer implementations, and platform files are excluded.

## Adding Project #11

Add one plain definition to `catalog/easyProjects.js` with the required metadata, starter function, function definition, visible examples, validation cases, and template/export paths. Run `npm run validate:projects`. No React page, route, component, validator, or export code change is required.
