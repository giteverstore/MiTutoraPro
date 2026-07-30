# AppShell

`src/app-shell/AppShell.jsx` is the reusable product frame for authenticated, non-course pages.

## Responsibilities

AppShell owns:

- the frozen product navigation
- desktop sidebar and persisted expanded/collapsed state
- mobile drawer and backdrop
- top navigation
- theme selection and persistence
- notifications placeholder visibility
- profile menu and sign-out action
- the shared scrollable page region

Navigation entries are defined once in `src/app-shell/navigation.js`: Home, Practice, Challenges, Bookmarks, Certificates, Referrals, and Settings.

## State boundary

AppShell may own transient shell state, but it must not own:

- selected course or lesson
- completed/visited lessons
- quiz or exercise state
- compiler source, output, runtime, or validation state

Those concerns remain in their existing providers. This keeps the shell reusable without importing Learning Engine or compiler modules.

## Page contract

AppShell accepts:

- `activePage`: the active navigation ID
- `onNavigate(pageId)`: the application-level navigation callback
- `children`: page content

Pages render content only. They do not reproduce the sidebar, theme toggle, notifications, or profile controls. `src/pages/` contains the application page entry modules.

Course Overview and the Learning Engine currently remain immersive course screens. Their course-specific navigation is not product navigation and is intentionally kept outside AppShell.

## Responsive behavior

- Desktop: persistent sidebar, optionally collapsed to an icon rail.
- Tablet: the same persisted expanded/collapsed behavior.
- Mobile (`≤720px`): sidebar becomes an off-canvas drawer; Escape or the backdrop closes it.

Theme and sidebar state use `mi-tutora:theme` and `mi-tutora:app-sidebar-collapsed`.

## Extension rules

Add a product destination by creating a page module, registering its icon and ID in `navigation.js`, and adding it to the page map in `src/App.jsx`. Do not add page-specific state to AppShell unless it is truly shared application chrome state.
