# Startup Performance

**Status: CURRENT**

MiTutora uses a small authentication core followed by route- and feature-specific JavaScript. This preserves immediate startup feedback without making Home parse learning, Practice, certification, project, editor, or detector code it does not use.

## Loading boundaries

The startup graph contains React, Firebase Auth, authentication/session providers, compiler interfaces, and the global error boundary. It does not contain page implementations.

After authentication, AppShell and user-data modules load. Each page is a dynamic entry. Course overview and Learning Engine share the `CourseRoute` boundary; Practice catalog and detail share the Practice boundary; certification exam and setup verification are independent boundaries.

Monaco loads only when an editor mounts. Python and Java create their own workers only when their runtime is requested. MediaPipe vision and Silero/ONNX load only from verification/proctoring workflows. Firebase Auth, Firestore, and Storage have separate initializers so importing Auth does not initialize the other Firebase products.

## Production budgets

`npm run build` emits Vite's production manifest. `npm run validate:bundle-budgets` measures the complete static entry closure using raw and freshly gzipped artifacts.

| Resource | Budget |
| --- | ---: |
| Initial JavaScript | 1,000,000 bytes raw |
| Initial JavaScript | 260,000 bytes gzip |
| Initial CSS | 250,000 bytes raw |
| Initial CSS | 40,000 bytes gzip |

The validator also requires every supported page/course/exam entry to remain dynamic and rejects Monaco, MediaPipe vision, or Silero in the initial static graph. It intentionally does not raise Vite's chunk warning threshold.

## Current measurements

| Measurement | Before Batch 6 | After Batch 6 |
| --- | ---: | ---: |
| Initial application JavaScript | 1,685.00 kB | 352.90 kB |
| Initial application JavaScript gzip | 432.76 kB | 93.33 kB |
| Initial CSS | 222.47 kB | 222.47 kB |
| Initial CSS gzip | 33.40 kB | 33.40 kB |

Firestore's shared lazy chunk and Monaco remain larger than Vite's default per-chunk threshold. This warning is retained because it reflects real cold-feature cost, even though those chunks are not initial-load dependencies.

## Extending the application

New AppShell pages should be registered through `lazyNamedExport`. Large browser SDKs must remain behind the feature that owns them. A new compiler language should register a lightweight runtime factory and create workers/assets only during runtime initialization. Run `npm run validate:remediation-batch-6` after changing imports, routes, Firebase initialization, editors, runtimes, or detector dependencies.
