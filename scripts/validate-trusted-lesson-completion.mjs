import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CourseCompletionService } from '../functions/src/certification/CourseCompletionService.js';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const manifest = await readJson('firebase-content/course-content/python/v2/course.json');
const course = await readJson('public/courses/python-course.json');
const metadata = await readJson('firebase-content/firestore/courses/python.json');
const endpointSource = await readFile('functions/src/index.js', 'utf8');
const clientSource = await readFile('src/progress/TrustedCompletionService.js', 'utf8');
const lessons = course.modules.flatMap((module) => module.sections.flatMap((section) => section.lessons));
const quizLesson = lessons[3];
const exerciseLesson = lessons.find((lesson) => lesson.blocks.some(({ type }) => type === 'exercise'));

class FakeDb {
  constructor() {
    this.records = new Map([['courses/python', metadata]]);
    this.writeCount = 0;
  }

  doc(path) {
    return {
      path,
      get: async () => ({
        exists: this.records.has(path),
        data: () => this.records.get(path),
      }),
    };
  }

  async runTransaction(operation) {
    return operation({
      get: async ({ path }) => ({
        exists: this.records.has(path),
        data: () => this.records.get(path),
      }),
      set: ({ path }, value) => {
        this.writeCount += 1;
        this.records.set(path, value);
      },
    });
  }
}

const db = new FakeDb();
const requestedStoragePaths = [];
const bucket = {
  file(path) {
    requestedStoragePaths.push(path);
    return { download: async () => [Buffer.from(JSON.stringify(manifest))] };
  },
};
const service = new CourseCompletionService({ db, bucket });
const uid = 'candidate-1';

const quizResult = await service.recordLessonCompletion(uid, {
  courseId: 'python',
  lessonId: quizLesson.id,
  completionType: 'quiz',
});
assert.equal(quizResult.completedLessons, 1);
assert.equal(quizResult.requiredLessons, 109);
assert.deepEqual(requestedStoragePaths, ['course-content/python/v2/course.json']);
assert.equal(db.writeCount, 1);

const trustedPath = `users/${uid}/trustedCourseProgress/python`;
assert.equal(db.records.get(trustedPath).completedLessons.includes(quizLesson.id), true);
assert.equal(db.records.get(trustedPath).lessonEvidence[quizLesson.id].type, 'quiz');

await service.recordLessonCompletion(uid, {
  courseId: 'python',
  lessonId: quizLesson.id,
  completionType: 'quiz',
});
assert.equal(db.writeCount, 1, 'Duplicate trusted completion must not create another write.');

const exerciseResult = await service.recordLessonCompletion(uid, {
  courseId: 'python',
  lessonId: exerciseLesson.id,
  completionType: 'exercise',
});
assert.equal(exerciseResult.completedLessons, 2);
assert.equal(db.records.get(trustedPath).lessonEvidence[exerciseLesson.id].type, 'exercise');
assert.equal(db.writeCount, 2);

await assert.rejects(
  service.recordLessonCompletion(uid, { courseId: 'python', lessonId: 'not-a-course-lesson' }),
  (error) => error.code === 'invalid-argument',
);
await assert.rejects(
  service.recordLessonCompletion(uid, { courseId: 'wrong-course', lessonId: quizLesson.id }),
  (error) => error.code === 'not-found',
);

assert.match(endpointSource, /if \(!request\.auth\?\.uid\) throw new HttpsError\('unauthenticated'/, 'Callable must reject unauthenticated requests.');
assert.match(endpointSource, /return request\.auth\.uid/, 'Callable identity must come from the verified authentication context.');
assert.doesNotMatch(clientSource, /\buid\b/, 'The client payload must not provide an authoritative UID.');
assert.match(clientSource, /\{ courseId, lessonId, completionType \}/, 'The client must send only the trusted-completion identifiers.');

console.log(JSON.stringify({
  courseId: metadata.id,
  version: metadata.version,
  nestedLesson: quizLesson.id,
  exerciseLesson: exerciseLesson.id,
  requiredLessons: quizResult.requiredLessons,
  duplicateWrites: db.writeCount - 2,
  authenticationAuthority: 'request.auth.uid',
  validation: 'passed',
}, null, 2));
