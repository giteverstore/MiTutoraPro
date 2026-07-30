# Library and Bookmarks

Library is the AppShell destination for saved course lessons, Practice questions, and Daily Challenges. The implementation lives under `src/bookmarks/`.

## Model and persistence

`bookmarkModel.js` creates a normalized record:

```js
{
  id: "practice:practice-even-or-odd",
  type: "course" | "practice" | "challenge",
  contentId,
  title,
  description,
  language,
  topic,
  target,
  savedAt
}
```

`target` is structured navigation data rather than a URL because the application currently uses state-based navigation. The model is persistence-ready and does not depend on React.

`BookmarkProvider` owns the current user’s collection and delegates storage to `bookmarkRepository`. The local implementation uses `mi-tutora:bookmarks:v1:<userId>`. A backend repository can replace `load`, `save`, and `clear` without changing consumers.

## Shared toggle

`BookmarkToggle` accepts a complete bookmark model and optional change callback. Learning Engine, Practice, Challenges, and Library use the same component. Course lesson toggles also synchronize the existing lesson-ID progress bookmark for backward compatibility.

## Library behavior

Library filters client-side by type and searches title, language, and topic. Statistics are derived from the normalized collection. `SavedItemCard` supplies one shared layout for all bookmark types while using type-specific icons and labels.

Opening a bookmark delegates to `src/App.jsx`:

- course target loads the course directly at the saved lesson;
- Practice target opens the saved question detail;
- Challenge target opens the single current Challenge page.

Bookmark state is independent from lesson completion, Practice completion, challenge rewards, compiler state, and runtime state.
