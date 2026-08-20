# UI design system

MiTutora Pro uses a layered design system so feature components remain focused on behavior while the product retains a consistent visual language.

## Styling layers

Styles load in this order:

1. `src/design-system/tokens.css` defines semantic color, typography, spacing, shape, elevation, motion, control, and layout values.
2. `src/design-system/primitives.css` defines reusable buttons, cards, inputs, and text roles.
3. `src/styles.css` contains feature-owned layout and component styles.
4. `src/design-system/coherence.css` applies shared product-level hierarchy, responsive behavior, interaction feedback, and accessibility preferences.

Feature code should consume semantic tokens instead of introducing colors, shadows, or motion durations that duplicate an existing role. Add a token only when the value represents a reusable design decision.

## Interaction principles

- Controls remain close to the content they affect and use familiar button, menu, tab, and disclosure behavior.
- Hover states clarify interactivity without large movement. Pressed states provide immediate, interruptible feedback.
- Navigation uses restrained emphasis and an inset accent to communicate location without turning every row into a card.
- Content hierarchy comes from typography, indentation, grouping, and whitespace before borders or decoration.
- Reading content is constrained to a readable measure; code and compiler surfaces use a separate semantic palette.
- Empty, loading, success, warning, and error states use semantic roles and must not rely on color alone.

## Responsive and accessibility contract

Layouts must work at desktop, tablet, mobile, and narrow mobile widths without fixed-position assumptions. Existing AppShell and Learning Engine layout state remains authoritative for sidebar and compiler behavior.

All interactive controls require visible keyboard focus. Coarse-pointer targets are at least 44px tall where possible. The coherence layer honors system reduced motion as well as the application reduced-motion, reduced-transparency, and increased-contrast preferences.

## Review checklist

- Confirm clear page, section, and action hierarchy.
- Test keyboard focus and control semantics.
- Test light and dark themes.
- Test desktop, tablet, mobile, sidebar open/closed, and compiler open/minimized states.
- Confirm reduced-motion behavior.
- Avoid new shadows, blur, cards, and animations unless they communicate a meaningful relationship.
