# Course JSON Schema

The canonical authoring contract is `schemas/learning-course.schema.json`, using JSON Schema Draft 2020-12. `examples/course.example.json` is the maintained compact example.

## Course document

A course requires:

- `schemaVersion`: currently exactly `1.0.0`
- `id`: stable kebab-case identifier
- `slug`: URL-safe authoring slug
- `title` and `description`
- `locale`: for example `en` or `en-US`
- `metadata`
- `navigation`
- one or more `modules`

The optional course `status` is `draft`, `published`, or `archived`.

### Metadata

Required metadata fields are semantic `version`, at least one author, `level`, `estimatedMinutes`, tags, and `updatedAt`. Optional fields include thumbnail and creation time. Schema version and content version are independent: schema changes describe contract compatibility; metadata version describes course revisions.

### Navigation

Course navigation declares:

- `defaultLessonId`
- `sequence: "module-order"`
- `skipLockedLessons`
- labels for previous, next, progress, and current lesson

The current runtime allows navigation to all known lessons. `skipLockedLessons` and lesson status remain in the authoring schema for compatibility and future policy, but do not lock the present UI.

## Module and lesson hierarchy

Modules require a unique `id`, title, and non-empty lesson list. Lessons require:

- stable unique `id`
- title and summary
- authoring status
- positive `estimatedMinutes`
- a `blocks` array, which may be empty by schema but should not be empty in production content

`number` preserves author-facing numbering such as `2.10`. It is display metadata, not an identity or navigation key.

Lesson navigation may override linear order with `previousLessonId`, `nextLessonId`, or two or more branches. `nextLessonId` and `branches` are mutually exclusive. Branch targets must exist; that cross-reference is validated outside JSON Schema.

## IDs and references

IDs use lowercase kebab case, start with a letter, and are 2–100 characters. Treat every course, module, lesson, block, option, and branch ID as stable once released because persistence refers to lesson and activity IDs.

The schema cannot portably enforce document-wide ID uniqueness or target existence. The Python validation script performs these checks for the production course; equivalent validation should apply to every released course.

## Metadata catalog

`public/courses/course-metadata.json` is the local course catalog:

```json
{
  "defaultCourseId": "python",
  "courses": [
    {
      "id": "python",
      "title": "MI Tutora Python Course",
      "description": "Beginner Python course.",
      "version": "1.0.0",
      "source": "/courses/python-course.json"
    }
  ]
}
```

The catalog ID must equal the loaded document ID, and `source` must be a public-root URL.

## Validation

Run:

```sh
npm run validate:course -- ../public/courses/<course>.json
npm run validate:python-course
```

The generic command validates schema shape. The Python command additionally checks metadata registration, unique IDs, registered block types, assets, activity integrity, placeholder content, and end-to-end navigation.

## Compiler compatibility

New content should use `language`, `starterCode`, `stdin`, `expectedOutput`, and a validator type. The schema and normalizer also accept legacy `files`, `activeFile`, `inputs`, and `validation` shapes for the current course. Do not introduce new legacy fields.
