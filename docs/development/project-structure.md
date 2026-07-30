# Project Structure

```text
MiTutoraPro/
├── docs/                 Developer reference and ADRs
├── examples/             Compact schema-valid course example
├── public/
│   ├── assets/courses/   Public course media
│   └── courses/          Metadata catalog and course documents
├── schemas/              Versioned JSON Schema
├── scripts/              Conversion, validation, and navigation checks
└── src/
    ├── app-shell/        Global authenticated product chrome
    ├── auth/             User context and replaceable repositories
    ├── bookmarks/        Library model, repository, provider, toggle, and page
    ├── compiler/
    │   ├── core/         Managers, contracts, registries, normalization
    │   ├── languages/    Language descriptors/composition
    │   ├── runtimes/     Language runtime implementations
    │   └── validators/   Output comparison strategies
    ├── components/       Learning Engine and shared React components
    │   └── blocks/       Registered lesson block components
    ├── challenges/       Daily challenge, rewards, streak, and mock history
    ├── course/           Course loading, model, selectors, navigation
    ├── course-overview/  Data-driven course overview screen
    ├── design-system/    Tokens, primitives, theme constants
    ├── home/             Home page content and mock catalog
    ├── hooks/            Reusable interaction hooks
    ├── pages/            Application page entry modules
    ├── practice/         Practice catalog, filters, detail, and mock data
    └── progress/         Progress context and repositories
```

## Composition roots

- `src/main.jsx` mounts React and global styles.
- `src/App.jsx` composes providers and application/course screen state.
- `src/compiler/createCompilerManager.js` registers runtimes and validators.
- `src/components/blockRegistry.js` registers lesson block renderers.
- `schemas/practice-question.schema.json` reuses those blocks for standalone practice.
- `schemas/daily-challenge.schema.json` reuses them for the daily challenge.
- `src/app-shell/navigation.js` defines product navigation.
- `src/settings/` owns the reusable settings service, subscriptions, controls, and page.
- `src/certificates/` owns certificate models, persistence, cards, verification, and viewer UI.
- `src/referrals/` owns referral models, persistence, sharing, rewards, history, and FAQ UI.

## Public versus source assets

Course JSON and course media live under `public/` because the browser fetches them by root-relative URL. React and compiler implementation modules live under `src/` and are bundled by Vite. Do not import a course JSON document into a component.

## Legacy folders

`src/dashboard/` contains the previous dashboard implementation and is not the current authenticated landing surface. New product-page work belongs in `src/pages/`, `src/home/`, and `src/app-shell/`. Remove legacy code only in a dedicated cleanup change so architecture work does not accidentally alter current behavior.
