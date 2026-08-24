# Content Safety Limits

**Status: CURRENT**

MiTutora validates content complexity before publication and applies defensive download ceilings in the browser. `src/content/validation/contentLimits.js` is the single source for course, Practice, and runtime limits.

## Publication pipeline

`Canonical source -> schema validation -> structural validation -> complexity validation -> artifact generation -> hash verification -> publication`

Course and Practice bundle loaders invoke the shared validators. The interactive-content generator validates every canonical Practice question before writing learner artifacts. Course converters validate the assembled course before writing their bundles. Publishers therefore cannot upload a bundle that their loader rejects.

The browser is not the authoritative enforcement boundary. `StorageContentLoader` nevertheless passes content-specific byte ceilings to Firebase Storage `getBytes()` and maps an exceeded ceiling to `content/size-exceeded`.

## Limits

| Content | Limit |
| --- | ---: |
| Course manifest | 1 MiB |
| Assembled course | 8 MiB |
| Course module | 2 MiB |
| Lesson | 256 KiB |
| Lessons per module | 500 |
| Blocks per lesson | 100 |
| Block/object depth | 12 |
| Text field | 50,000 characters |
| Code field | 100,000 characters |
| Quiz options | 20 |
| Examples per content item | 20 |
| Practice question | 256 KiB |
| Practice metadata record | 16 KiB |
| Practice compiler configuration | 192 KiB |
| Practice tests | 100 |

Byte limits use UTF-8 bytes through `TextEncoder`; they are not inferred from JavaScript string length.

## Measured baseline

Batch 7 measured Java v1, Python v1/v2, and all 200 Practice artifacts:

| Metric | Current maximum | Source |
| --- | ---: | --- |
| Lessons/module | 129 | Java v1 module 1 |
| Blocks/lesson | 22 | Java lesson 3.2.6 |
| Block depth | 4 | Java quiz lesson 1.1.5 |
| Text/block | 686 characters | Python v1 solution block |
| Code/block | 648 characters | Java v1 code block |
| Lesson JSON | 4,099 bytes | Java lesson 4.1.30 |
| Module JSON | 317,461 bytes | Java v1 module 1 |
| Course manifest | 177,587 bytes | Java v1 |
| Assembled course | 626,376 bytes | Java v1 |
| Practice question | 4,248 bytes | `fund-errors-018` |
| Practice metadata | 607 bytes | `fund-errors-014` |
| Practice examples | 1 | Multiple questions |
| Practice object depth | 6 | `fund-loops-013` |

Run `npm run analyze:content-complexity` to reproduce measurements and `npm run validate:content-limits` to validate canonical bundles.
