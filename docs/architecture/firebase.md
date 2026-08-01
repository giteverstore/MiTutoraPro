# Firebase foundation

Firebase is an isolated infrastructure boundary. Sprint 8.1 establishes SDK initialization and thin adapters only; no application feature, service, or repository currently depends on Firebase.

## Folder structure

```text
src/firebase/
├── firebase.js   # SDK configuration and singleton instances
├── auth.js       # Authentication helper functions
├── firestore.js  # Firestore instance boundary
└── storage.js    # Storage instance boundary
```

Only files inside `src/firebase/` and `src/repositories/firestore/` may import the Firebase SDK directly. Future application services should consume repositories rather than importing from `firebase/app`, `firebase/auth`, `firebase/firestore`, or `firebase/storage`.

## Initialization flow

`firebase.js` reads the Vite environment, validates that every required value is present, and initializes the default Firebase application. It uses Firebase's existing-app lookup before initialization so development hot reloads cannot create duplicate default apps.

The initialized application creates and exports singleton instances:

```text
Vite environment
      ↓
firebaseConfig
      ↓
Firebase app
  ├── Auth
  ├── Firestore
  └── Storage
```

The module fails with an error listing missing variable names when configuration is incomplete. It never logs credential values.

## Environment variables

Create a local `.env` file from `.env.example` and provide the web-app configuration from the Firebase console:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Vite exposes variables prefixed with `VITE_` to browser code. Firebase web configuration identifies the Firebase project but should still be supplied through deployment environment configuration. Local `.env` is ignored by Git; `.env.example` contains names only and remains committed.

## Module responsibilities

### `firebase.js`

- Validates configuration.
- Initializes or reuses the default Firebase app.
- Exports `app`, `auth`, `db`, and `storage`.

### `auth.js`

Provides the authentication boundary for future consumers:

- `signInWithGoogle()`
- `signInWithEmail(email, password)`
- `signUpWithEmail(email, password)`
- `signOutUser()`
- `getCurrentUser()`
- `onAuthStateChanged(next, error?, completed?)`

These helpers return the Firebase SDK promises, credentials, or unsubscribe function without introducing UI state or application-specific user mapping.

### `firestore.js`

Exports the configured `db` instance for the isolated Firestore repository layer.

### `storage.js`

Exports the configured `storage` instance. Upload paths, download behavior, and file policies intentionally remain undefined.

## Current integration status

Firebase Authentication now provides application session state through `AuthProvider` and `AuthContext`. Learning progress, course loading, Practice, Challenges, Library, Settings, Certificates, Referrals, and compiler infrastructure remain on their existing implementations.

## Authentication layer

Authentication is separated into four responsibilities under `src/auth/`:

```text
AuthRepository
      ↓
AuthService
      ↓
AuthProvider
      ↓
AuthContext consumers
```

- `AuthRepository` is the only authentication-layer module that calls the Firebase wrappers. It also coordinates the Firestore `UserRepository` for the authenticated user document.
- `AuthService` normalizes Firebase users into the application session model and converts provider error codes into user-facing errors.
- `AuthProvider` restores the Firebase session with an auth-state observer and prevents authenticated content from rendering until the initial state resolves.
- `AuthContext` exposes `user`, `loading`, `isAuthenticated`, sign-in, registration, sign-out, and refresh operations.

On the first authenticated session, `users/{uid}` is created with provider identity fields and timestamps. If the document already exists, the authentication flow updates only `lastLogin`; profile fields are not overwritten.

The existing `UserContext` remains temporarily active for local learning-profile and progress-compatible fields. A compatibility gate aligns its local user identity with the Firebase UID while later persistence migrations remain out of scope. Components use `AuthContext` for authentication actions and do not import Firebase Auth.

## Firestore repository layer

Firestore persistence is isolated under `src/repositories/firestore/`:

```text
src/repositories/firestore/
├── BaseRepository.js
├── UserRepository.js
├── CourseRepository.js
├── ProgressRepository.js
├── SettingsRepository.js
├── BookmarkRepository.js
├── paths.js
└── converters.js
```

`BaseRepository` owns Firestore document and collection operations. It provides `get`, `set`, `update`, `remove`, `exists`, `list`, and `query`. Query callers provide plain filter, ordering, and limit descriptors; Firestore SDK constraints remain internal to the repository boundary.

Specialized repositories select a collection path and converter only. They contain no learning, progress-calculation, authentication, or UI logic. `SettingsRepository` adds convenience accessors for the fixed preferences document while retaining the base operations.

### Path conventions

All collection and document paths are generated by `paths.js`. IDs are validated as single path segments before interpolation. Current conventions are:

```text
users/{uid}
users/{uid}/settings/preferences
users/{uid}/progress/{courseId}
users/{uid}/bookmarks/{bookmarkId}
users/{uid}/achievements/{achievementId}
users/{uid}/certificates/{certificateId}
users/{uid}/statistics/overview
users/{uid}/coinTransactions/{transactionId}
courses/{courseId}
practiceQuestions/{questionId}
dailyChallenges/{challengeId}
```

Collection names and fixed document IDs must be added to `paths.js`; they must not be repeated in repositories or consumers.

### Converters

User, Course, Progress, Settings, and Bookmark repositories each use a registered converter from `converters.js`. The initial converters preserve fields without domain transformation. This gives future schema migrations and timestamp normalization one dedicated boundary without changing repository consumers.

### Isolation rationale

Keeping Firebase behind initialization wrappers and repositories prevents SDK snapshots, references, query constraints, and persistence-specific errors from spreading through components and services. A future migration can replace a local repository implementation at the service boundary without changing application screens or domain behavior. Sprint 8.2 does not perform that migration.
