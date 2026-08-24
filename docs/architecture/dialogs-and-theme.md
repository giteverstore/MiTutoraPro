# Dialog and Theme Ownership

**Status: CURRENT**

## Dialogs

`src/components/Dialog.jsx` owns modal semantics and focus lifecycle. `Dialog` provides the reusable modal boundary; `ConfirmDialog` adds explicit cancel/confirm actions without owning feature business logic.

The primitive supplies an accessible role, labelled title, optional associated description, initial focus, focus trapping, Escape handling, trigger-focus restoration, background inerting, topmost-dialog keyboard ownership, responsive actions, destructive styling, and reduced-motion behavior. Settings resets and compiler code replacement use `ConfirmDialog`; certificate preview and exam warnings use the same base primitive.

Automated checks demonstrate these encoded behaviors, not full WCAG or assistive-technology compliance. Manual testing remains necessary.

## Theme

`SettingsService appearance preference -> useApplicationTheme -> semantic tokens -> components`

`useApplicationTheme` is the only system-color-scheme observer. It resolves `light`, `dark`, and `system`, while SettingsService owns persistence and authenticated restoration. AppShell, Learning Layout, Course Overview, legacy Dashboard, and exam experiences no longer write a separate `mi-tutora:theme` localStorage value.

Theme colors remain owned by `src/design-system/tokens.css`. Legitimate domain colors such as code syntax and execution status remain component-specific. Monaco editor appearance remains intentionally independent.
