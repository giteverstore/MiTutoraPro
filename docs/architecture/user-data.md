# User data persistence

User-owned progress, bookmarks, settings, certificates, and referrals are persisted in Firestore through `UserDataService`. Components and domain services do not import Firebase or Firestore repositories.

## Flow

```text
UI context or domain service
          ↓
existing public service/repository API
          ↓
UserDataService
          ↓
user-scoped Firestore repository
          ↓
Firestore
```

`UserDataService` exposes asynchronous operations only. It owns user-scoped repository creation, friendly error translation, in-memory caching, serialized writes, and cache cleanup. Progress and Bookmark retain their existing repository-shaped APIs; Settings retains its synchronous external snapshot while hydrating and persisting asynchronously; Certificate and Referral retain their service methods.

## Firestore layout

```text
users/{uid}/progress/{courseId}
users/{uid}/bookmarks/{bookmarkId}
users/{uid}/settings/preferences
users/{uid}/certificates/{certificateId}
users/{uid}/referrals/profile
```

Progress documents contain `courseId`, `currentModule`, `currentLesson`, completed lesson/exercise/quiz state, completion percentage, `startedAt`, `lastOpened`, and `updatedAt`. Compatibility fields used by the existing progress engine are retained so lesson-state calculations do not change.

Bookmarks and certificates use one document per model ID. Collection replacements use an atomic Firestore batch, preventing partially updated lists. Settings and referrals use fixed document IDs.

## Cache and offline behavior

Reads always try Firestore first so another device's changes are observable. Successful results enter a user-scoped in-memory cache. If Firestore is temporarily unavailable, a read may return an existing cached value. Without a cache, callers receive a friendly typed `UserDataError`.

Writes are serialized per document or collection and update cache only after Firestore confirms success. Failed writes therefore do not silently overwrite cached state or pretend to have reached the server. Firebase error codes and SDK errors remain in the internal `cause`; UI consumers receive stable messages and user-data error codes.

## Authentication lifecycle

`UserDataLifecycle` observes the existing `AuthContext` without changing authentication. On login it selects the Firebase UID and hydrates settings. On logout or account switch it clears repository instances, queued writes, and every in-memory user-data cache. A subsequent login reads Firestore again, enabling cross-device synchronization.

Local repository implementations remain temporarily in source for compatibility and migration reference, but active Progress, Bookmark, Settings, Certificate, and Referral services no longer import or use them. Browser-only sidebar layout preferences and the legacy local profile compatibility layer are outside this migration.
