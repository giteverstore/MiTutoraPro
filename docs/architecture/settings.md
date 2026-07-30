# Settings

Settings is an AppShell page under `src/settings/`. It provides Profile, Editor, Learning, Notifications, Appearance, Privacy, and About sections without owning the systems those preferences configure.

## SettingsService

`SettingsService` is a framework-independent service with `getSetting`, `setSetting`, `resetSettings`, `exportSettings`, and a subscription interface used by React.

The local instance persists a versioned settings document at `mi-tutora:settings:v1`. Defaults live in `settingsDefaults.js`. The service accepts a storage adapter through its constructor, providing the replacement seam for a backend or synchronized repository. `useSettings` exposes its snapshot through `useSyncExternalStore`.

## Global consumers

- AppShell resolves System, Light, or Dark application theme and applies reduced-motion behavior.
- `MonacoCodeEditor` consumes editor theme, font size, tab size, wrapping, line numbers, and minimap preferences.
- `CompilerPanel` reads Auto Format on Run and delegates formatting to `CompilerManager.format`.

Application appearance and editor theme are independent settings.

## Data controls

Destructive reset actions use confirmation dialogs. Learning reset clears the current user’s course progress and mirrored profile summaries. Practice, Challenge, and Library resets clear their user-scoped local repository prefixes and reload so mounted providers cannot retain stale state.

Practice and Challenge progress are currently mock in-memory state; reload clears the current mock session. Privacy actions are explicit placeholders for future account services. Settings export downloads a versioned JSON document.

The About section reports application, Learning Engine, compiler, Monaco, and Pyodide versions. Update these values during releases.
