# Adding a Course

## 1. Create the document

Copy `examples/course.example.json` and author against `schemas/learning-course.schema.json`. Choose a stable course ID and semantic metadata version. Set a valid default lesson ID.

Build modules and lessons in intended linear order. Preserve author-facing lesson numbers in `number`; use IDs for references.

## 2. Add blocks

Use only types registered in `src/components/blockRegistry.js`. Follow the [lesson block](../content/lesson-blocks.md), [quiz](../content/quiz-blocks.md), and [exercise](../content/exercise-blocks.md) contracts.

Production lessons should have meaningful blocks even though the base schema permits an empty block array.

## 3. Add assets

Place images and media under:

```text
public/assets/courses/<course-id>/
```

Reference them from JSON with root-relative paths such as `/assets/courses/<course-id>/diagram.png`. Confirm every referenced file exists and provide accessible alt text or captions.

## 4. Register metadata

Add an entry to `public/courses/course-metadata.json`:

```json
{
  "id": "course-id",
  "title": "Course title",
  "description": "Catalog description.",
  "version": "1.0.0",
  "source": "/courses/course-id.json"
}
```

The entry ID and document ID must match. Home currently uses mock metadata, so catalog registration makes a course loadable but does not automatically add a Home card.

## 5. Validate

Run generic schema validation with a path relative to `scripts/`:

```sh
npm run validate:course -- ../public/courses/course-id.json
```

Also check:

- document-wide unique IDs;
- navigation targets exist and terminate;
- quiz answer IDs exist;
- exercises have compiler data where execution is required;
- compiler languages and validators are registered;
- assets resolve from `public/`;
- no placeholder content remains.

The Python-specific validator demonstrates these additional checks. Generalizing it for all catalog courses is roadmap work.

## 6. Test the workflow

Open the course from Home, inspect Course Overview metadata, traverse every lesson, exercise branching if present, complete quizzes/exercises, reload to verify persistence, reset progress in development mode, and verify mobile/desktop layouts.

Changing released lesson or block IDs can orphan local progress. Prefer additive content revisions or plan an explicit migration.
