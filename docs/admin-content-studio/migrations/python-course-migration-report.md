# Python Course migration (Phase 9)

Source: `public/courses/python-course.json`. This is a content-only migration; the source file and learner progress are unchanged. `node scripts/content/migrate-python-course.mjs --dry-run` is the default, read-only conversion. `--seed-emulator` requires `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` (or another loopback port) and `FIREBASE_PROJECT_ID=demo-mitutora`; it never publishes. A differing existing draft is rejected unless `--overwrite` is explicitly supplied with `--seed-emulator`.

## Inventory and parity

| Item | Source | Canonical draft |
| --- | ---: | ---: |
| Course IDs | `python` | `python` |
| Modules | 1 | 1 |
| Sections | 10 | 10 |
| Lessons | 109 | 109 |
| Blocks | 648 | 648 |
| Images | 17 | 17 |
| Quizzes | 20 | 20 |
| Compiler blocks | 63 | 63 |
| Exercise blocks | 18 | 18 |
| Standalone expected-output blocks | 0 | 0 |
| Compiler blocks with expected output | 18 | 18 |

The historical estimate of 6 modules/68 lessons/406 blocks does not match the current repository. All 648 block IDs, types, order, text, code, quiz answers and runtime fields compare equal after removing the additive `assetId` field. The canonical validator passes; there are no unsupported or silently discarded source block types.

| Source block type | Count | Canonical mapping | Admin editable | Learner rendered | Loss |
| --- | ---: | --- | --- | --- | --- |
| paragraph | 285 | unchanged Course paragraph | yes | yes | none |
| heading | 43 | unchanged Course heading | yes | yes | none |
| callout | 27 | unchanged Course callout | yes | yes | none |
| code | 145 | unchanged Course code | yes | yes | none |
| compiler | 63 | unchanged Course compiler | yes | yes | none |
| image | 17 | unchanged `src`, additive `assetId` | yes | yes | none |
| quiz | 20 | unchanged options, correct IDs, labels | yes | yes | none |
| exercise | 18 | unchanged files/instructions/objectives | yes | yes | none |
| solution | 18 | unchanged explanation/code | yes | yes | none |
| note | 10 | unchanged Course note | yes | yes | none |
| table | 2 | unchanged Course table | yes | yes | none |

Course `id`, `slug`, title, description, level, duration and tags map to canonical Course metadata. Module/section/lesson/block IDs remain stable; only `order` is added from array position. The source schema URI/version, locale, publication status, author/update metadata and navigation labels are retained under envelope `metadata.migration`; the learner adapter restores the source navigation and tags while retaining the new published content version. Some provenance fields are preserved but not exposed as editable fields in Course Studio.

All 17 image paths are safe `/assets/` references and exist under `public/assets/courses/python-foundations/`. The migration adds deterministic asset IDs and creates 17 matching `adminContentAssets` registry documents in the emulator. It does not embed or upload image bytes; the existing static assets remain required at deployment. Publication checks the registry. No image references were unresolved.

All 63 compiler blocks remain in their lessons with `python` language and existing starter/runtime/validation fields; 8 have nonempty stdin. All 20 quizzes retain their original option IDs and correct-answer IDs. Correct answers are held in the canonical artifact for evaluation, not displayed by the learner renderer before submission.

## Size, import and acceptance

Dry-run conversion plus validation took about 49–79 ms on this workstation. Serialized canonical draft: 173,496 bytes; estimate before publication: 173,496 bytes. Actual emulator Firestore root draft document: 1,838 JSON bytes; one segmented module document: 172,196 JSON bytes. Actual published v1 artifact in the Storage emulator: 173,579 bytes. The module is well below the 850,000-byte module limit and Firestore's 1 MiB document boundary.

The emulator import created one cloud draft, and a second identical run skipped it. Course Studio loaded the real draft, listed its lessons, edited metadata, autosaved/reloaded, validated and opened Generated JSON. Browser-observed times in one local run: initial load 409 ms, module selection 138 ms, lesson selection 126 ms, validation 135 ms, autosave 665 ms, JSON view 350 ms. Preview rendered early, middle, compiler, image, quiz and final lessons. These are browser observations, not guaranteed performance budgets.

The local Firestore/Storage emulator published this draft as v1 and read it back as ACTIVE with 109 lessons and representative quiz/compiler blocks. In an authenticated learner-browser smoke, a test publication of the real migrated document appeared in Library, opened its overview, enrolled, completed the first lesson, recorded pinned content version 1, advanced to the compiler lesson and restored that lesson after reload. The learner then ran its real Python compiler starter and observed the expected output, completed the following image lesson, selected the correct answer in the first migrated quiz, completed it, and reloaded into the same lesson. The test publication used isolated in-memory artifact storage with the Firebase Auth/Firestore emulators for learner state. The same real document was separately published in the local Firestore/Storage emulators. This is representative learner coverage, not a browser run of all 109 lessons or 63 compiler blocks. Legacy content is retained.

No production Firebase, learner progress, or live publication was changed.
