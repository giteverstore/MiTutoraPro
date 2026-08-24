# Validation Command Conventions

**Status: CURRENT**

- `scripts/validate-*.mjs` are deterministic validators that exit non-zero when an invariant fails.
- `scripts/test-*.mjs` execute runtime/behavior harnesses.
- `tests/**/*.test.{js,jsx}` are Vitest suites.
- `npm run validate:<domain>` is the canonical validation command.
- `npm run test:<domain>` is reserved for behavioral, unit, or browser tests.

`validate:course` orchestrates the example schema plus every registered Python and Java course validator. The former scope remains available as `validate:course-example`. `validate:navigation` is canonical; `test:navigation` remains a compatibility alias.

`npm run validate:script-conventions` checks command/file alignment and missing entrypoints. Compatibility aliases must not be removed without a documented migration.
