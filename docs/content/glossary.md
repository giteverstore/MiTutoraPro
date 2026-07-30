# Glossary

**AppShell**  
Authenticated product frame containing global navigation, theme, notifications, profile controls, and the shared page region.

**Block**  
The smallest ordered JSON content unit rendered inside a lesson. Its `type` selects a registered component.

**Block registry**  
Mapping from block type IDs to React components in `src/components/blockRegistry.js`.

**Compiler block**  
Lesson block defining the language, starter source, stdin, expected output, and validator used by the compiler workspace.

**CompilerManager**  
Language-neutral service that resolves runtimes and validators and coordinates initialize, execute, format, reset, validate, and dispose operations.

**Course catalog / metadata**  
`public/courses/course-metadata.json`, which maps a course ID to its local JSON source.

**Course document**  
A JSON file conforming to `schemas/learning-course.schema.json`.

**Course model**  
The normalized in-memory course returned by `createCourseModel`, containing author data plus UI defaults.

**Exercise verification**  
Persisted confirmation that successful program output matches expected output under a registered validator.

**Learning Engine**  
The loader, model, navigation, block renderer, lesson UI, and completion flow that turn course JSON into an experience.

**Lesson state**  
Not Started, Visited, or Completed. It is independent from whether navigation is allowed.

**Module**  
An ordered collection of lessons within a course.

**Monaco**  
The browser code editor used for compiler lessons.

**Output validator**  
A strategy that compares expected and actual program output.

**Progress repository**  
Storage abstraction for course-scoped learning state; currently backed by localStorage.

**Pyodide**  
CPython compiled to WebAssembly, used by the Python runtime in a Web Worker.

**Runtime adapter**  
Language execution implementation satisfying `RuntimeAdapter`.

**Sequential progress**  
The number of consecutively completed lessons from the beginning of the course, used for course percentage.

**Starter code**  
Initial editable source loaded from a compiler block and restored by Reset.

**Visited lesson**  
A lesson that has been opened at least once but is not necessarily complete.
