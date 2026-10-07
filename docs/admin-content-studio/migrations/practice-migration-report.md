# Practice bank migration (Phase 9)

Source: `src/practice/practiceData.js` and its ten imported batches. `node scripts/content/migrate-practice.mjs --dry-run` is the read-only default. `--seed-emulator` has the same loopback Firestore and `demo-mitutora` guards as the Course migration. It creates one canonical PRACTICE draft per stable question ID and never publishes automatically.

## Inventory and mapping

| Item | Source | Canonical drafts |
| --- | ---: | ---: |
| Questions | 200 | 200 |
| Python questions | 200 | 200 |
| Easy / medium / hard | 193 / 6 / 1 | 193 / 6 / 1 |
| Starter code | 200 | 200 |
| Expected output | 200 | 200 |
| Duplicate question IDs | 0 | 0 |

Topic counts: variables-data-types-expressions 20; conditionals 20; loops 20; functions 20; strings 20; arrays-lists 20; dictionaries-hash-maps 20; sets 20; input-output-parsing 15; error-handling-mixed 19; and the older title-cased categories Conditionals 1, Loops 1, Strings 2, Lists 1, Dictionaries 1. Topic casing is intentionally preserved.

| Source | Canonical mapping | Information retained |
| --- | --- | --- |
| `id`, title, summary, language, difficulty, topic/category/subtopic | `contentId`/`questionId` and Practice metadata | exact IDs and strings; language lowercased only for canonical runtime ID |
| question type, duration, XP, skills, prerequisites, constraints, hints, examples | corresponding Practice fields | unchanged |
| heading, paragraph, note, code blocks | Practice `blocks` | IDs, content and ordering unchanged |
| compiler block | `starterCode`, `stdin`, `verification.expectedOutput` | compiler ID/labels/validator retained in envelope migration metadata and restored for learner delivery |
| `validator: normalized` | `comparison: normalized-lines` | existing line-normalized expected-output semantics |
| public tests, contract, complexity, concepts, common mistakes | corresponding Practice fields | unchanged |
| `implementations` and source schema version | envelope migration metadata | restored to the learner model; not directly editable in Studio |

All 200 canonical documents validate. The source has 594 heading, 200 paragraph, 391 note, 200 code and 200 compiler blocks. No source field or block type is silently dropped: unknown fields/types fail conversion. IDs, titles, problem blocks, starter code, stdin, expected output, public tests and ordering are preserved. The canonical comparison mode is not stricter than the source's normalized output mode. There are no non-Python variants to invent.

The bank's canonical drafts total about 594,630 JSON bytes; the largest individual draft is 3,547 bytes. Conversion plus validation took about 87–108 ms in local runs. Some public-test arguments contain nested arrays, which Firestore rejects as native nested array values. The existing Admin draft store now saves Practice document JSON losslessly and hydrates it on read. Draft listing now paginates beyond the former 100-item limit, so all 200 questions are visible. This is storage representation only, not a new content schema.

## Emulator and browser acceptance

All 200 drafts were seeded into the local `demo-mitutora` Firestore emulator; rereunning the import skipped all 200 without revision changes. A changed existing draft was rejected without `--overwrite`. The Admin cloud draft listing returned all 201 imported records (200 Practice plus one Course), and a nested-array public-test argument survived round-trip. A small representative subset (`practice-even-or-odd`, `fund-variables-008`) was published v1 in local Firestore/Storage emulators and read back as ACTIVE. Wrong versus correct normalized output validation was checked.

Practice Studio opened a real migrated question, validated it, previewed and executed Python, rejected wrong output, accepted correct output, reset the editor and reloaded the draft. Existing published-first Practice code de-duplicates canonical and legacy entries with the same question ID; a focused test asserts one logical listing. The complete 200-question bank was **not** published, and Java/C++ Preview does not apply because this source bank is Python-only.

An authenticated learner-browser smoke used the real migrated `practice-even-or-odd` document: discovery/search, starter-code display, wrong-output rejection, correct Python execution/acceptance, saved version-`v1` completion and completed state after reload all passed. The test publication used isolated in-memory artifacts with Firebase Auth/Firestore emulators for learner state. Rollback/version-transition behavior for this exact source question was **not** rerun; the existing cross-content acceptance tests cover those semantics with fixtures. All legacy source files and pre-existing user progress remain untouched; there were no production Firebase writes.
