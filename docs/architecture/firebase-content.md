# Firebase content infrastructure

The backend-ready content boundary lives under `src/content/`. Courses, Practice, and Daily Challenges now use it. Progress, bookmarks, and settings retain their existing data sources.

## Loading pipeline

```text
Firestore metadata
       ↓
Content repository
       ↓
Firebase Storage path
       ↓
StorageContentLoader → in-memory ContentCache
       ↓
Content service normalization
       ↓
Typed metadata + parsed content object
```

Repositories own persistence access. Services coordinate metadata and content retrieval and return normalized objects. UI components, learning logic, and existing loaders remain independent of Firebase.

## Firestore collections

Metadata uses centralized helpers from `src/repositories/firestore/paths.js`:

```text
courses/{courseId}
practiceQuestions/{questionId}
dailyChallenges/{challengeId}
```

Documents contain normalized metadata and a `storagePath`; content bodies live in Storage. Services reject unpublished content unless an infrastructure caller explicitly requests it.

## Storage conventions

`src/content/utils/contentPaths.js` is the single source for generated paths:

```text
course-content/{courseSlug}/{version}/course.json
course-content/{courseSlug}/{version}/module-{moduleNumber}.json
practice/{language}/{version}/{questionSlug}.json
daily-challenges/{language}/{version}/{YYYY-MM-DD}.json
```

Course metadata stores its root, such as `course-content/python`, and its version folder, such as `v2`. Practice and challenge metadata store an unversioned object path such as `practice/python/question-1.json`; repositories insert the metadata version before the filename. No active loader embeds a course version in application code.

The active Python layout is:

```text
course-content/python/v2/
├── course.json
└── module-1.json
```

The canonical Python bundle contains `course.json` and `module-1.json`. The manifest contains the course-level schema, complete content-free outline, and ordered `moduleFiles`. Its single top-level chapter module contains ten generic section records used as learner-facing chapter groups. Each group owns its lessons directly.

Published course version folders are immutable. Content changes require a new version folder; the publisher refuses to replace an existing object with different bytes. It uploads and verifies every versioned object before updating the Firestore metadata pointer, preventing clients from observing new metadata with an older cached manifest.

## Responsibilities

Repositories read Firestore metadata and download JSON through the shared loader. `BaseContentRepository` keeps these operations free of UI and application rules. Repositories reuse the existing Firestore `BaseRepository` and do not expose SDK references or snapshots.

`CourseService`, `PracticeService`, and `ChallengeService` normalize metadata, enforce publication state, deserialize JSON, and return clean content objects. They contain no rendering, progress, or completion behavior. For Python, `CourseService.getCourse(id)` reads `courses/{id}`, loads the versioned manifest and initial required module, and returns the existing course contract. The course session retains the full outline independently from lazily loaded lesson content.

All three services extend `BaseContentService`. The base owns metadata retrieval, normalized model creation, publication checks, version resolution, and the shared metadata-to-JSON loading sequence. Specialized services provide only their repository download operation and lightweight content-shape validator.

Practice reads the ACTIVE publication pointer, queries only that version's published metadata in stable `position`/document-ID order, and downloads a question body only when selected. Firestore cursors bound every page. Daily Challenges query the latest published metadata document and download its versioned JSON payload. Both pages continue to feed their existing block renderer and compiler components.

## Cache and errors

`StorageContentLoader` downloads bytes, verifies an expected SHA-256 from trusted metadata before parsing, checks for an object or array, and accepts an optional structural validator. `ContentCache` is bounded and stores successful results and in-flight promises by normalized Storage path plus hash so concurrent calls share one download. Firestore metadata reads use the same cache behavior with a collection/document cache key. Failed requests are evicted. `CourseService.invalidateCourse()` invalidates both metadata and every versioned course object.

Stable `ContentError` codes distinguish missing metadata, missing Storage objects, malformed JSON, unpublished content, invalid metadata, and other download failures.

## Adding content later

Adding a course requires uploading its manifest and module JSON files using the convention and creating one `courses/{courseId}` metadata document with matching `storagePath` and `version`. No course-specific frontend source change is required.

The upload and metadata update are automated by the [Firebase course publisher](../development/content-publishing.md). It validates the fully merged course before remote writes and verifies Storage objects and Firestore metadata after publication.

## Metadata lookup and fallback

Opening the Python course queries its Firestore document ID, rejects missing or unpublished metadata, derives the versioned Storage paths, downloads and merges content, and then invokes the existing Learning Engine model. Typed errors reach the existing `CourseLoadState` friendly error UI rather than crashing the application.

During Vite development, `VITE_COURSE_CONTENT_SOURCE=local` makes the course loader read `public/courses/course-metadata.json` and its referenced course document before contacting Firebase. This is the intended mode for verifying unpublished generated bundles. The default value is `firebase`. When Firebase is selected, a failed request falls back to local content only when `VITE_ENABLE_LOCAL_COURSE_FALLBACK=true`. Production builds always use Firebase regardless of either development setting.

Practice supports an explicit development-only source selector. Add this to an untracked `.env.local` file and restart Vite to test the canonical catalog from `src/practice/practiceData.js` without publishing it:

```dotenv
VITE_PRACTICE_CONTENT_SOURCE=local
```

Remove the variable or set it to `firebase` to restore the normal Firebase-first loading path. Production builds always use Firebase, even if `VITE_PRACTICE_CONTENT_SOURCE=local` is configured accidentally. The selected source is authoritative; Firebase and local questions are never merged. Files under `firebase-content/` remain publishing and validation artifacts and are not a runtime content source.

Practice and Challenge retain development-only failure fallbacks:

```dotenv
VITE_ENABLE_LOCAL_PRACTICE_FALLBACK=true
VITE_ENABLE_LOCAL_CHALLENGE_FALLBACK=true
```

Their fallback payloads remain in `practiceData.js` and `challengeData.js`. UI-only mock statistics, solved IDs, challenge history, and streak values intentionally remain local. Production builds never use any local content fallback.

## Practice and Challenge upload bundles

Run `npm run build:firebase-interactive-content` to generate:

```text
firebase-content/
├── practice/python/v1/question-1.json ... question-200.json
├── daily-challenges/python/v1/2026-08-01.json
└── firestore/
    ├── practiceQuestions.json
    └── dailyChallenges.json
```

The files under `firestore/` are upload-ready metadata arrays; each object maps to a document whose ID is its `id`. Run `npm run validate:firebase-interactive-content` to verify schemas, exact local-content parity, compiler definitions, and normalized output validation.
