# Python Foundations import report

## Import summary

`Python Module 1.docx` is the authoritative source for the canonical `python` course. The previous Python course was replaced by **Python Foundations**. It contains one top-level chapter module, `CH 1: Getting Started with Python`, with ten independently collapsible chapter groups (`1.1` through `1.10`). These groups contain 109 lessons, 20 quizzes, 18 coding exercises, 52 runnable explanatory examples, and 18 revealable solutions. The generic section abstraction represents the chapter groups in data while learner-facing terminology remains chapter-based. All 18 unique embedded image assets are referenced by the generated lesson content, including the repeated note-callout icon.

The numbered source ends at page 9.7. Eight explicitly titled conclusion and review sections that follow it are represented as lessons 9.8 through 9.15 so they remain navigable and are not merged into the preceding lesson.

## Source issues requiring editorial review

- Page numbering skips 4.11 and 4.15. No content was invented for those numbers.
- Lesson, quiz, exercise, and block identifiers are derived from this authoritative source. They are not aliased to obsolete lesson identifiers from the replaced course. Existing progress sanitization continues to discard identifiers that no longer belong to canonical content.
- The conclusion sections beginning with “Congratulations” and ending with “FINISH” have no `PAGE x.y` labels. Their generated 9.8–9.15 lesson numbers are structural import metadata, not source page numbers.
- Page 2.12 asks learners to print `100`, while its displayed expected output shows `10`; the supplied solution prints `100`. The imported expected output remains `10`.
- Page 4.12 asks for an `item` variable containing `10` and then `"Book"`, while the supplied solution uses `var`, `25`, and `"John"`. Both instructions and solution are preserved.
- Page 5.8 asks for `Hey` and `How are you`, while its expected output and solution use `Hii` and `Welcome to Go Coder`. The displayed expected output is preserved for validation.
- Page 6.7 defines cost price as 50 and selling price as 30, then describes the result as a profit of 20. The stated subtraction produces `-20`, while the displayed expected output is `20`. The source values, wording, solution, and expected output remain unchanged.
- Page 6.16 shows `volume =` with the formula omitted. The Word document contains an equation object Mammoth cannot convert; the supplied solution later uses `length ** 3`.
- Page 9.5 says the triangle area “can be calculated using” but the formula is omitted. A second unsupported Word equation object is present; the supplied solution later contains Heron’s formula.
- Page 8.4 consistently spells the sample last name `Micheal`; it is preserved rather than corrected.
- The supplied solutions on pages 8.9 and 9.5 use prompts inside `input()`, while their displayed expected outputs contain only the calculated result. The browser runtime captures prompt text in stdout, so those revealed solutions do not match the displayed-output validator without removing the prompts. Both source solution and expected output are preserved for editorial review.
- Several example output regions are present in Word as non-text visual elements. Where the source contains no extractable output text, the converter omits an empty code block instead of reconstructing an answer. Runnable source code remains unchanged.
- The source contains labels such as `sensAl` and wording/transcription issues such as `Computer the profit`. These are preserved in source-derived content where represented.

## Figures and links

All 18 unique embedded PNG assets are extracted under `public/assets/courses/python-foundations/`. Figure labels are paired with their corresponding images and used as accessible alt text. The decorative icon repeated inside note callouts is referenced through the generic note block asset field.

The document includes real URLs for the following references, and the importer preserves them as Markdown links:

- Meaningful Python variable names
- Printing Basics in Python
- Python operator precedence and associativity
- Python Assignment Operator
- Understanding Python's `type()`
- Practice: Python Basics

No URL was invented.

## Architecture notes

The existing Learning Engine schema, course loader, navigation, progress context, Monaco editor, Pyodide runtime, compiler manager, and normalized output validator remain authoritative. A generic `solution` block was added because the previous schema had no way to retain supplied solutions without displaying them immediately. It uses a native collapsed disclosure element and does not introduce Python-course-specific rendering logic.

The generated versioned Firebase bundle is upload-ready but is not deployed by this import. Production will continue serving the currently published Firebase object until the new bundle is published through the existing publishing workflow.
