# Current Roadmap

This roadmap records implementation gaps visible in the current codebase. It is directional, not a delivery commitment.

## Current baseline

- Authenticated client-side application with local profile storage
- Reusable AppShell and frozen product navigation
- Data-driven Course Overview and Learning Engine
- Schema-valid production Python course
- Registry-based lesson blocks
- Sequential learning progress with local persistence
- Monaco editor and worker-based Pyodide execution
- Language-neutral compiler manager, runtimes, and validators
- Schema-driven Practice catalog and detail workflow using shared blocks and compiler
- Schema-driven Daily Challenge with mock rewards, streak, and history
- User-scoped Library bookmarks across lessons, Practice, and Challenges
- Backend-ready SettingsService with global AppShell and Monaco preferences
- User-scoped certificate records, viewer, verification, and in-progress cards
- User-scoped referral profile, reward explanation, history, and sharing workflow

## Near-term: stability and validation

- Generalize production course integrity validation across every metadata entry.
- Align `test:navigation` with the current free-navigation policy. The script still expects locked lessons to be skipped, while `createCourseNavigation` intentionally treats all known lessons as navigable.
- Add automated tests for sequential progress, quiz gating, exercise verification, and repository restoration.
- Add runtime execution timeout and explicit cancellation UI.
- Resolve or intentionally configure current Vite warnings for Pyodide compatibility imports and Monaco bundle size.
- Remove superseded dashboard code after confirming no remaining imports.

## Near-term: content operations

- Add a repeatable authoring/lint workflow for IDs, navigation references, assets, and placeholder detection.
- Validate every catalog course in one command.
- Define content migrations for schema versions and released ID changes.
- Add preview tooling for content writers.
- Replace Home mock course metadata with the catalog through an explicit product change.

## Medium-term: language expansion

- Make Monaco language selection dynamic; it is currently Python-specific.
- Add a browser JavaScript runtime as the second adapter implementation.
- Define validators for numeric tolerance, exact line output, and test cases.
- Establish runtime capability metadata for stdin, packages, formatting, and file models.
- Evaluate remote adapters for Java, C++, SQL, and other runtimes unsuitable for fully local execution.

## Medium-term: product pages

- Replace remaining mock product data with repository-backed API integrations when services are available.
- Replace notification placeholder data with a repository/API boundary.
- Add accessible empty, loading, and error states for each page.

## Longer-term: platform services

- Replace local user/progress repositories with authenticated APIs without changing consumer components.
- Add cross-device progress synchronization and conflict policy.
- Introduce course search, catalog pagination, and hundreds-course discovery.
- Add CI checks, artifact deployment, observability, and error reporting.
- Self-host or explicitly cache Pyodide assets where deployment requirements demand offline/reliable startup.

## Non-goals for infrastructure changes

AppShell must remain independent from lesson progress and compiler state. Runtime additions must not require Learning Engine branches. Content additions must not require hardcoded JSX.
