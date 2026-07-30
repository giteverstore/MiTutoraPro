# Exercise Blocks

An exercise describes the learner’s task. Executable setup and expected output belong in a companion `compiler` block in the same lesson.

## Shape

```json
{
  "id": "exercise-print-values",
  "type": "exercise",
  "title": "Print the values",
  "instructions": {
    "content": "Write a program that prints 1 and 2 in order.",
    "format": "plain"
  },
  "objectives": ["Produce the required output"],
  "difficulty": "easy",
  "hints": ["Call print for each value."],
  "actionLabel": "Start exercise"
}
```

Required fields are `title`, rich-text `instructions`, and at least one objective. Difficulty may be `easy`, `medium`, or `hard`.

## Companion compiler

For output-verified exercises, include a compiler block in the lesson:

```json
{
  "id": "compiler-print-values",
  "type": "compiler",
  "language": "python",
  "starterCode": "# Write your solution\n",
  "stdin": "",
  "expectedOutput": "1 2",
  "validator": "normalized"
}
```

`Layout` associates the current lesson’s first exercise ID with its compiler data. Keep one required exercise/compiler pair per lesson until multi-workspace association is explicitly implemented.

## Completion flow

1. The learner starts the exercise.
2. They edit current Monaco source.
3. Run executes that current source.
4. A successful runtime result enables `Check Output`.
5. The validator compares expected and program output.
6. A match persists `verified: true`.
7. The learner presses `Mark Complete`.
8. The lesson footer can then complete the exercise lesson.

Running alone never verifies or completes an exercise. Expected output is display/validation data and is never used as program output.

Changing code or rerunning invalidates an uncompleted verification. Once an exercise is completed, its stored completion remains.

## Normalized validation

The current validator ignores line-ending differences, leading/trailing whitespace, and repeated whitespace while preserving token order. It is appropriate for simple text output, not numeric tolerances, unordered collections, or hidden test cases. Those require a separately registered validator.
