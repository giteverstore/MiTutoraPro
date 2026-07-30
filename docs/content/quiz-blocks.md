# Quiz Blocks

Quiz blocks are client-side knowledge checks whose attempts are stored in course progress.

## Shape

```json
{
  "id": "quiz-variable-name",
  "type": "quiz",
  "question": "Which name is a valid Python variable?",
  "selectionMode": "single",
  "options": [
    { "id": "option-a", "text": "2value" },
    { "id": "option-b", "text": "value_2" }
  ],
  "correctOptionIds": ["option-b"],
  "explanation": "Names cannot begin with a digit.",
  "submitLabel": "Check answer"
}
```

`selectionMode` is `single` or `multiple`. Each option needs a unique stable ID. Every `correctOptionIds` entry must reference an option in the same block.

## Scoring

The UI requires an exact set match for a passing attempt:

- no required correct option may be missing;
- no additional option may be selected.

The stored record contains score, maximum score, percentage, passed status, attempt count, and timestamp. A later failed attempt updates the latest record, so lesson completion checks the current stored `passed`/percentage state.

## Lesson completion

When a lesson contains quizzes, every quiz block must be passed before `Complete Lesson` is enabled. Quiz submission does not automatically complete the lesson; the learner explicitly completes it in the lesson footer.

## Authoring guidance

- Use one unambiguous learning objective per question.
- Make distractors plausible without relying on trick wording.
- For multiple selection, state that multiple answers may be correct.
- Explain why the correct answer is correct.
- Avoid option labels such as “all of the above” that become fragile when options change.
- Never change released option or block IDs solely to edit wording; IDs connect to saved attempts.
