# Application routing

**Status: CURRENT, INCREMENTAL**

[`src/routing/appRoutes.js`](../../src/routing/appRoutes.js) adapts stable browser URLs to the existing state coordinator in [`src/App.jsx`](../../src/App.jsx). It does not replace AppShell, page components, services, or domain state.

Supported routes include `/`, AppShell pages, `/courses/:courseId`, `/courses/:courseId/lesson/:lessonId`, `/practice`, and `/practice/:questionId`. Direct load restores the resource, navigation writes browser history, and `popstate` restores prior state. Malformed or unknown routes show a recovery view.

Only validated stable identifiers enter URLs. Auth tokens, evidence, trusted completion data, answers, and transient exam state remain outside URLs. Certification launches continue through their authenticated owning page; complete exam URL restoration is intentionally not claimed.
