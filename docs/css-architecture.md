# CSS architecture

The application loads global CSS from `src/styles/index.css`. Its import order is part of the cascade contract and mirrors the former monolithic `src/styles.css` ordering.

## Directory ownership

- `design-system/` contains existing global tokens, primitives, and final coherence overrides.
- `styles/foundation/` contains document-level defaults and accessibility utilities.
- `styles/layout/` owns cross-page application layout such as the authenticated shell.
- `styles/pages/` owns cohesive product surfaces. Closely related surfaces may share a file when their selectors and responsive behavior are coupled.
- `styles/routing.css` and `styles/public-pages.css` retain their established route-level ownership.

Do not create a stylesheet for every React component. Prefer a page or feature boundary such as `practice.css`, and move a rule into a shared component sheet only when the component is genuinely reused with the same semantics.

## Cascade and responsive policy

`index.css` imports files in explicit cascade order. Do not reorder imports merely to make the directory list alphabetical: later equal-specificity declarations may intentionally override earlier rules. `design-system/coherence.css` remains loaded after the global entry from `main.jsx` and therefore keeps its final-override role.

Feature-specific media queries, container queries, reduced-motion rules, and keyframes stay with their owning feature. Only genuinely global shell breakpoints belong in a layout stylesheet. Route-level CSS splitting is intentionally not used; all global selectors remain available for lazy routes.

## Adding or changing styles

1. Put global tokens in the existing design-system token sheet; do not create competing token systems.
2. Put document defaults in `foundation/`, shell structure in `layout/`, and feature behavior in the corresponding `pages/` file.
3. Preserve existing class names unless a separate behavioral refactor requires a rename.
4. Use section banners for meaningful ownership areas, not comments for individual declarations.
5. Check source order, responsive states, and `coherence.css` before increasing specificity.

Dead selectors, duplicate declarations, token normalization, CSS Modules, and route-level CSS loading are separate cleanup projects. Structural moves should preserve first and simplify later.
