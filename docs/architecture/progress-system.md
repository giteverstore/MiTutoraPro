# Progress System

`LearningProgressProvider` owns course-scoped learning progress. It receives the loaded course and user ID, restores repository state, derives computed fields, and exposes mutation methods through `useLearningProgress`.

## Persisted state

Progress includes:

- current lesson ID
- visited lesson IDs
- completed lesson IDs
- completed module IDs
- quiz scores and attempt metadata
- exercise verification/completion state
- bookmarks
- sequential completed lesson count
- course percentage
- estimated minutes remaining
- last update timestamp

The local repository key is `mi-tutora:learning-progress:v1:<userId>:<courseId>`. `progressRepository.js` is the replacement boundary for a future API.

## Three lesson states

- Not Started: absent from visited and completed lists.
- Visited: present in `visitedLessons`; opening a lesson records this state.
- Completed: present in `completedLessons`; completed lessons are also treated as visited.

Navigation is unrestricted. Completion and progress calculation are separate.

## Sequential progress

Dashboard/course percentage uses the longest consecutive completed prefix beginning with the first lesson in module order. If lessons 1, 2, 4, and 5 are completed, sequential progress is 2. Completing lesson 3 makes it 5.

`completedLessonCount` still tracks all completed lessons, while `visitedLessonCount` tracks all visited lessons. This distinction must be maintained.

## Derived values

Every update passes through `deriveProgress`, which:

- removes IDs not present in the current course;
- deduplicates arrays;
- derives completed modules;
- calculates the sequential prefix and percentage;
- totals estimated minutes for incomplete lessons.

## Quiz and exercise state

Quiz records store score, maximum score, percentage, passed status, attempt count, and last attempt time. Exercise verification and completion are separate. `completeExercise` is a no-op until the exercise has a verified output state. Editing or rerunning invalidates uncompleted verification.

## Profile synchronization

`ProgressProfileSync` in `src/App.jsx` mirrors selected summary fields into the local user profile for Home/dashboard use. The course-scoped progress repository remains the authoritative detailed record.
