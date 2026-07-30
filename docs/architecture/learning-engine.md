# Learning Engine

The Learning Engine turns a validated course document into a navigable, block-rendered lesson experience. Its main modules are under `src/course/` and `src/components/`.

## Loading

`courseRepository.js` fetches `/courses/course-metadata.json`, resolves the requested course entry, and fetches its `source`. `CourseLoaderProvider` then:

1. maps the document with `createCourseModel`;
2. builds navigation with `createCourseNavigation`;
3. restores the requested lesson when that ID exists;
4. otherwise selects `navigation.defaultLessonId`;
5. exposes status, errors, selectors, and navigation actions through context.

Loading is abortable with `AbortController`. Fetch failures become the loader error state rather than an empty lesson.

## Course model

`createCourseModel` preserves author-provided IDs, modules, lessons, navigation, and blocks. It adds view defaults such as labels, shortcut copy, sidebar text, lesson details, and a fallback compiler display model.

Content fields should not be added in UI components. Add them to the schema and model only when a view-level normalization is required.

## Navigation

`createCourseNavigation` flattens modules and lessons in author order and indexes them by lesson ID. It supports:

- linear previous/next traversal
- explicit `previousLessonId` and `nextLessonId`
- branch options with a default branch
- free navigation to any known lesson ID

The current implementation treats every known lesson as navigable, regardless of the schema’s authoring `status`. This matches the current “no locked future lessons” product behavior. See the [roadmap](../roadmap/current-roadmap.md) for validation/test alignment.

## Rendering

`Layout.jsx` receives the loader object and composes the lesson sidebar, content area, optional compiler workspace, resizers, keyboard shortcuts, and course-specific top navigation. `BlockRenderer` looks up each `block.type` in `blockRegistry.js`. Unknown types render `UnknownBlock`; an empty block array renders the configured empty state.

The compiler panel appears only when the current lesson contains a `compiler` block. The compiler block is removed from the normal content list and rendered in the workspace region.

## Completion

`LessonFooter` determines the completion gate:

- reading lesson: footer must enter the viewport;
- quiz lesson: every quiz block must have a passing score;
- exercise lesson: every exercise block must be marked completed after verification.

Completing the lesson updates `LearningProgressProvider`; navigation itself remains unrestricted.
