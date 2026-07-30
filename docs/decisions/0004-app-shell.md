# ADR 0004: Reusable AppShell

- Status: Accepted
- Scope: Authenticated product navigation and layout

## Context

Authenticated product pages need the same sidebar, responsive drawer, top navigation, theme control, notifications placeholder, and profile menu. Implementing these separately in each page created duplicated state and inconsistent responsive behavior. Course screens also have specialized lesson navigation that must remain independent.

## Alternatives

1. Let every page own its navigation and theme. Simple locally, but duplicates common layout and behavior.
2. Put all application and learning state in one global layout context. Centralized, but tightly couples product chrome to course progress and compiler state.
3. Use a reusable product AppShell with a narrow contract, while keeping immersive course navigation in the Learning Engine.
4. Introduce a routing framework as part of the refactor. Useful eventually, but unnecessary for the current state-driven application and outside the infrastructure scope.

## Decision

Create `src/app-shell/AppShell.jsx` with reusable sidebar and top-navigation components. AppShell owns only shared chrome state and accepts active page, navigation callback, and page children. Frozen navigation lives in one registry. Page entry modules live under `src/pages/`.

Course Overview and the Learning Engine remain immersive flows outside product chrome. Their selected course, lesson progress, and compiler state stay in existing providers.

## Consequences

### Positive

- Global navigation and responsive behavior have one owner.
- Pages render content without duplicating shell markup.
- Theme, drawer, notifications, and profile menus remain consistent.
- Learning Engine and compiler boundaries remain independent.

### Negative

- The application currently uses state-based page selection rather than URL routing.
- Product and immersive course screens use different layout frames.
- Adding a page requires registering both navigation and page composition.

### Follow-up

If routing is introduced, keep AppShell’s page-content contract and move page selection to the router. Do not move course or compiler state into AppShell.
