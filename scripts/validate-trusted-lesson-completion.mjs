import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CourseCompletionService } from '../functions/src/certification/CourseCompletionService.js';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const manifest = await readJson('firebase-content/course-content/python/v2/course.json');
const moduleDocument = await readJson('firebase-content/course-content/python/v2/module-1.json');
const metadata = await readJson('firebase-content/firestore/courses/python.json');
const endpointSource = await readFile('functions/src/index.js', 'utf8');
const clientSource = await readFile('src/progress/TrustedCompletionService.js', 'utf8');
const lessons = moduleDocument.sections.flatMap((section) => section.lessons);
const readingLesson = lessons.find((lesson) => !lesson.blocks.some(({ type }) => ['quiz', 'exercise'].includes(type)));
const quizLesson = lessons.find((lesson) => lesson.blocks.some(({ type }) => type === 'quiz'));
const exerciseLesson = lessons.find((lesson) => lesson.blocks.some(({ type }) => type === 'exercise'));

class FakeDb {
  constructor() { this.records = new Map([['courses/python', metadata]]); this.writeCount = 0; }
  snapshot(path) { return { exists: this.records.has(path), data: () => this.records.get(path) }; }
  doc(path) { return { path, get: async () => this.snapshot(path), set: async (value) => { this.writeCount += 1; this.records.set(path, value); } }; }
  async runTransaction(operation) {
    return operation({
      get: async ({ path }) => this.snapshot(path),
      set: ({ path }, value) => { this.writeCount += 1; this.records.set(path, value); },
      update: ({ path }, value) => { this.writeCount += 1; this.records.set(path, { ...this.records.get(path), ...value }); },
    });
  }
}

let now = 1_000_000;
const db = new FakeDb();
const bucket = { file(path) { return { download: async () => [Buffer.from(JSON.stringify(path.endsWith('/course.json') ? manifest : moduleDocument))] }; } };
const service = new CourseCompletionService({ db, bucket, clock: () => now, evidenceTtlMs: 5000 });
const uid = 'candidate-1';

await assert.rejects(service.recordLessonCompletion(uid, { courseId: 'python', courseVersion: 'v2', lessonId: readingLesson.id }), (error) => error.code === 'failed-precondition');
await assert.rejects(service.beginLessonEvidence(uid, { courseId: 'python', courseVersion: 'v1', lessonId: readingLesson.id }), (error) => error.code === 'failed-precondition');
await assert.rejects(service.beginLessonEvidence(uid, { courseId: 'python', courseVersion: 'v2', lessonId: 'not-a-course-lesson' }), (error) => error.code === 'invalid-argument');

const readingSession = await service.beginLessonEvidence(uid, { courseId: 'python', courseVersion: 'v2', lessonId: readingLesson.id });
assert.equal(db.records.has(`users/${uid}/trustedCourseProgress/python`), false, 'Opening a lesson must not complete it.');
await assert.rejects(service.recordLessonCompletion('candidate-2', { courseId: 'python', courseVersion: 'v2', lessonId: readingLesson.id, evidence: { sessionId: readingSession.sessionId, challenge: readingSession.challenge } }), (error) => ['not-found', 'permission-denied'].includes(error.code));
await assert.rejects(service.recordLessonCompletion(uid, { courseId: 'python', courseVersion: 'v2', lessonId: readingLesson.id, evidence: { sessionId: readingSession.sessionId, challenge: 'wrong' } }), (error) => error.code === 'permission-denied');
const readingResult = await service.recordLessonCompletion(uid, { courseId: 'python', courseVersion: 'v2', lessonId: readingLesson.id, evidence: { sessionId: readingSession.sessionId, challenge: readingSession.challenge } });
assert.equal(readingResult.completedLessons, 1);
const writesAfterReading = db.writeCount;
await service.recordLessonCompletion(uid, { courseId: 'python', courseVersion: 'v2', lessonId: readingLesson.id, evidence: { sessionId: readingSession.sessionId, challenge: readingSession.challenge } });
assert.equal(db.writeCount, writesAfterReading, 'Duplicate valid evidence must be idempotent.');

const staleSession = await service.beginLessonEvidence(uid, { courseId: 'python', courseVersion: 'v2', lessonId: readingLesson.id });
now += 5001;
await assert.rejects(service.recordLessonCompletion(uid, { courseId: 'python', courseVersion: 'v2', lessonId: readingLesson.id, evidence: { sessionId: staleSession.sessionId, challenge: staleSession.challenge } }), (error) => error.code === 'deadline-exceeded');

const quizSession = await service.beginLessonEvidence(uid, { courseId: 'python', courseVersion: 'v2', lessonId: quizLesson.id });
await service.recordLessonCompletion(uid, { courseId: 'python', courseVersion: 'v2', lessonId: quizLesson.id, evidence: { sessionId: quizSession.sessionId, challenge: quizSession.challenge } });

const exerciseSession = await service.beginLessonEvidence(uid, { courseId: 'python', courseVersion: 'v2', lessonId: exerciseLesson.id });
await service.recordLessonCompletion(uid, { courseId: 'python', courseVersion: 'v2', lessonId: exerciseLesson.id, evidence: { sessionId: exerciseSession.sessionId, challenge: exerciseSession.challenge } });

const trusted = db.records.get(`users/${uid}/trustedCourseProgress/python`);
assert.equal(trusted.lessonEvidence[readingLesson.id].assurance, 'MANUAL_COMPLETION');
assert.equal(trusted.lessonEvidence[quizLesson.id].assurance, 'MANUAL_COMPLETION');
assert.equal(trusted.lessonEvidence[exerciseLesson.id].assurance, 'MANUAL_COMPLETION');
assert.equal(service.engine.evaluate(manifest, { schemaVersion: '2.0.0', completedLessons: [readingLesson.id], lessonEvidence: { [readingLesson.id]: { sessionId: 'legacy', assurance: 'PROTOCOL_OBSERVED' } } }).completedLessons, 1);
assert.match(endpointSource, /beginTrustedLessonEvidence/);
assert.match(endpointSource, /return request\.auth\.uid/);
assert.doesNotMatch(clientSource, /\buid\b/);

console.log(JSON.stringify({ courseId: metadata.id, version: metadata.version, requiredLessons: readingResult.requiredLessons, manualCompletionTypes: ['reading', 'quiz', 'exercise'], authenticationAuthority: 'request.auth.uid', validation: 'passed' }, null, 2));
