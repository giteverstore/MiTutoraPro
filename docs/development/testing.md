# Testing

MiTutora combines invariant validators with focused behavioral tests.

## Commands

- `npm run test:batch-4` runs Vitest and React Testing Library coverage for error containment, settings persistence, compiler isolation, and Python worker lifecycle.
- `npm run test:e2e` builds the application in `e2e` mode and runs Playwright desktop/mobile projects.
- Existing `validate:*` commands continue to verify content, trust, layout, runtime, and publication invariants.

## Browser environment

The Playwright suite uses local Firebase Authentication and Firestore emulators with a demo project. Practice and course content use explicit test-mode local sources; production source selection is unchanged. Python and Java execute through the same Monaco/compiler/runtime paths used by the built application.

The suite covers authenticated AppShell/Home, course overview and lesson navigation, Practice pagination/detail, settings save-and-reload persistence, and Python/Java runtime smoke attempts. Runtime smoke tests are tagged `@runtime` and run only in the desktop project; mobile validates the responsive journeys without duplicating heavyweight runtime initialization. It is a focused critical-flow baseline, not comprehensive coverage of every product journey, browser, certification Function, accessibility behavior, or failure mode.

Playwright reports and test results are generated locally and ignored by Git. The Firebase emulator requires a supported Java runtime.
