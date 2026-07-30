# Lesson Blocks

Every lesson is rendered from its ordered `blocks` array. Each block has a stable `id`, a registered `type`, and an optional anchor. `BlockRenderer` resolves types through `src/components/blockRegistry.js`; unknown types render an explicit error component.

## Supported types

| Type | Required content | Purpose |
| --- | --- | --- |
| `heading` | `level`, `text` | H2–H6 content hierarchy |
| `paragraph` | `content` | Plain or Markdown explanatory text |
| `code` | `language`, `code` | Scrollable read-only example |
| `image` | `src`, `alt` | Course asset with optional caption |
| `note` | `content` | Neutral supporting information |
| `warning` | `title`, `content` | Important caution |
| `quiz` | question, mode, options, answers | Interactive knowledge check |
| `exercise` | title, instructions, objectives | Learner task and completion control |
| `compiler` | language and starter source | Editable execution workspace |
| `divider` | none | Optional labeled separation |
| `callout` | tone, title, content | Info, tip, or success emphasis |
| `video` | title, source | Media, poster, captions, transcript |
| `table` | columns, rows | Structured comparison data |
| `ai_explanation` | title, context, action label | Local explanation interaction |

The exact constraints live in `schemas/learning-course.schema.json`.

## Authoring principles

- Keep blocks focused on one semantic purpose.
- Preserve reading order; assistive technology and the renderer use array order.
- Use headings in a valid hierarchy and do not use them only for visual size.
- Put prose in paragraph/callout fields rather than embedding HTML.
- Supply meaningful image alt text; use an empty string only for truly decorative images.
- Store public course assets under `/assets/courses/<course>/`.
- Give interactive blocks stable IDs because progress is keyed by block ID.
- Use `code` for examples and `compiler` only when editing/execution is required.

## Registering a new block

Adding a block requires coordinated changes:

1. add its schema definition and type enum;
2. implement a component under `src/components/blocks/`;
3. register it once in `blockRegistry.js`;
4. add an example and validation coverage;
5. document the authoring fields here.

Do not add a `switch` to `BlockRenderer`. It deliberately contains no type-specific business logic.

## Empty and unknown behavior

An empty blocks array produces the lesson empty state configured by the course model. Production courses should avoid this; `validate:python-course` rejects empty lessons. An unknown type renders `UnknownBlock` rather than failing the entire lesson, but schema validation should catch it before release.
