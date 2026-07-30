# Release Process

The project currently produces a static Vite build. There is no automated deployment or formal version publishing pipeline in the repository, so releases are verified build artifacts plus versioned course content.

## 1. Define scope

Record user-visible changes, content changes, schema changes, persistence changes, and known limitations. If a contract changes, update these docs and add or supersede an ADR where the architectural decision changes.

## 2. Validate content

```sh
npm run validate:course
npm run validate:python-course
npm run validate:practice
npm run validate:challenge
npm run test:navigation
```

For a new course, run the generic validator against its document and perform the additional integrity checks described in [Adding a course](adding-a-course.md).

Do not release courses with duplicate IDs, missing assets, empty lessons, invalid answers, dangling navigation, or placeholder content.

## 3. Build

```sh
npm install
npm run build
```

The output is written to `dist/`. Build warnings must be reviewed. Current known warnings concern Pyodide’s Node compatibility imports being externalized by Vite and the Monaco chunk exceeding the default size threshold.

## 4. Smoke test

Using `npm run preview`, verify:

- authentication/profile creation and local session restore;
- AppShell navigation, responsive sidebar/drawer, theme, and sign-out;
- Home → Course Overview → Learning Engine → Course Overview → Home;
- complete traversal of the production course;
- quiz pass/fail and attempt persistence;
- exercise run, output mismatch/match, verification, and completion;
- Monaco keyboard behavior;
- Python stdout, stderr, stdin, reset, and repeat execution;
- refresh persistence and reset controls.

Test at desktop, tablet, and mobile widths.

## 5. Version content

Increment course `metadata.version` when released content changes. Change `schemaVersion` only when adopting a new schema contract. Preserve released IDs unless a progress migration is provided.

## 6. Ship and observe

Deploy the exact verified `dist/` artifact through the hosting process used by the environment. Record the source revision, course versions, build command, validation results, and known warnings. A future CI/CD pipeline should automate these gates.
