import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { CourseCompletionEngine } from './CourseCompletionEngine.js';
import { CERTIFICATION_POLICY } from './CertificationPolicy.js';

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
const trustedProgressPath = (uid, courseId) => `users/${uid}/trustedCourseProgress/${courseId}`;
const evidencePath = (uid, sessionId) => `users/${uid}/trustedLessonEvidence/${sessionId}`;
const normalizeOutput = (value) => String(value ?? '').replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim().replace(/\s+/g, ' ')).filter(Boolean).join('\n');

function moduleLessons(module) {
  return Array.isArray(module.sections) ? module.sections.flatMap((section) => section.lessons ?? []) : module.lessons ?? [];
}

function lessonKind(lesson) {
  const types = new Set((lesson.blocks ?? []).map(({ type }) => type));
  if (types.has('quiz')) return 'quiz';
  if (types.has('exercise')) return 'exercise';
  return 'reading';
}

export class CourseCompletionService {
  constructor({ db, bucket, engine = new CourseCompletionEngine(), clock = () => Date.now(), readingMinimumMs = 3000, evidenceTtlMs = 30 * 60 * 1000 }) {
    this.db = db;
    this.bucket = bucket;
    this.engine = engine;
    this.clock = clock;
    this.readingMinimumMs = readingMinimumMs;
    this.evidenceTtlMs = evidenceTtlMs;
    this.manifestCache = new Map();
    this.moduleCache = new Map();
  }

  async courseDefinition(courseId) {
    const metadataSnapshot = await this.db.doc(`courses/${courseId}`).get();
    if (!metadataSnapshot.exists || metadataSnapshot.data().published !== true) fail('not-found', 'Published course metadata was not found.');
    const metadata = metadataSnapshot.data();
    const key = `${metadata.storagePath}/${metadata.version}/course.json`;
    if (!this.manifestCache.has(key)) {
      this.manifestCache.set(key, this.bucket.file(key).download().then(([bytes]) => {
        try { return JSON.parse(bytes.toString('utf8')); }
        catch (error) { error.code = 'data-loss'; throw error; }
      }).catch((error) => { this.manifestCache.delete(key); throw error; }));
    }
    return { metadata, manifest: await this.manifestCache.get(key) };
  }

  async manifest(courseId) { return (await this.courseDefinition(courseId)).manifest; }

  async lessonDefinition(courseId, manifest, metadata, lessonId) {
    const moduleIndex = manifest.modules.findIndex((module) => moduleLessons(module).some(({ id }) => id === lessonId));
    if (moduleIndex < 0) fail('invalid-argument', 'The lesson is not part of this course version.');
    const file = manifest.moduleFiles?.[moduleIndex];
    if (!file) fail('data-loss', 'The published course manifest does not identify the lesson content module.');
    const path = `${metadata.storagePath}/${metadata.version}/${file}`;
    if (!this.moduleCache.has(path)) {
      this.moduleCache.set(path, this.bucket.file(path).download().then(([bytes]) => JSON.parse(bytes.toString('utf8')))
        .catch((error) => { this.moduleCache.delete(path); if (!error.code) error.code = 'data-loss'; throw error; }));
    }
    const module = await this.moduleCache.get(path);
    const lesson = moduleLessons(module).find(({ id }) => id === lessonId);
    if (!lesson) fail('data-loss', 'The published lesson outline does not match its content module.');
    return lesson;
  }

  async beginLessonEvidence(uid, { courseId, courseVersion, lessonId }) {
    if (!courseId || !lessonId) fail('invalid-argument', 'courseId and lessonId are required.');
    const { metadata, manifest } = await this.courseDefinition(courseId);
    if (!courseVersion || courseVersion !== metadata.version) fail('failed-precondition', 'The requested course version is not currently published.');
    const requirements = this.engine.requirements(manifest);
    if (!requirements.lessonIds.includes(lessonId)) fail('invalid-argument', 'The lesson is not part of this course version.');
    const lesson = await this.lessonDefinition(courseId, manifest, metadata, lessonId);
    const nowMs = this.clock(); const sessionId = randomUUID(); const challenge = randomUUID();
    const session = {
      sessionId, challenge, ownerUid: uid, courseId, courseVersion: metadata.version,
      courseProgressVersion: requirements.courseProgressVersion, lessonId, evidenceType: lessonKind(lesson),
      state: 'OPEN', openedAt: Timestamp.fromMillis(nowMs), expiresAt: Timestamp.fromMillis(nowMs + this.evidenceTtlMs),
      consumedAt: null, schemaVersion: '1.0.0',
    };
    await this.db.doc(evidencePath(uid, sessionId)).set(session, { merge: false });
    return session;
  }

  validateEvidence(session, lesson, evidence, nowMs) {
    if (!evidence?.sessionId || !evidence?.challenge) fail('failed-precondition', 'A server-issued lesson evidence session is required.');
    if (session.challenge !== evidence.challenge) fail('permission-denied', 'Lesson evidence challenge is invalid.');
    if (nowMs > session.expiresAt.toMillis()) fail('deadline-exceeded', 'Lesson evidence session has expired.');
    const type = lessonKind(lesson);
    if (type !== session.evidenceType) fail('failed-precondition', 'Lesson evidence type does not match published content.');
    if (type === 'reading') {
      if (nowMs - session.openedAt.toMillis() < this.readingMinimumMs) fail('failed-precondition', 'Reading evidence session has not met the minimum observation period.');
      return { type, assurance: 'PROTOCOL_OBSERVED', sessionId: session.sessionId };
    }
    if (type === 'quiz') {
      const answers = evidence.answers ?? {};
      if (!answers || Array.isArray(answers) || typeof answers !== 'object' || Object.keys(answers).length > 16) fail('invalid-argument', 'Quiz evidence payload is invalid.');
      const quizzes = lesson.blocks.filter(({ type: blockType }) => blockType === 'quiz');
      const passed = quizzes.length > 0 && quizzes.every((quiz) => {
        const submitted = [...new Set(answers[quiz.id] ?? [])].sort();
        const expected = [...new Set(quiz.correctOptionIds ?? [])].sort();
        return submitted.length === expected.length && submitted.every((value, index) => value === expected[index]);
      });
      if (!passed) fail('failed-precondition', 'Quiz evidence did not satisfy the published answer key.');
      return { type, assurance: 'SERVER_GRADED', sessionId: session.sessionId };
    }
    const artifacts = evidence.artifacts ?? {};
    if (!artifacts || Array.isArray(artifacts) || typeof artifacts !== 'object' || Object.keys(artifacts).length > 8) fail('invalid-argument', 'Exercise evidence payload is invalid.');
    const compilers = lesson.blocks.filter(({ type: blockType }) => blockType === 'compiler');
    const verified = compilers.length > 0 && compilers.every((compiler) => {
      const artifact = artifacts[compiler.id];
      return typeof artifact?.sourceCode === 'string' && artifact.sourceCode.trim().length > 0 && artifact.sourceCode.length <= 100_000
        && typeof artifact?.programOutput === 'string' && artifact.programOutput.length <= 100_000
        && normalizeOutput(artifact.programOutput) === normalizeOutput(compiler.expectedOutput);
    });
    if (!verified) fail('failed-precondition', 'Exercise evidence did not satisfy the published output contract.');
    return { type, assurance: 'SERVER_VALIDATED_CLIENT_EXECUTION', sessionId: session.sessionId };
  }

  async recordLessonCompletion(uid, { courseId, courseVersion, lessonId, evidence }) {
    if (!courseId || !lessonId) fail('invalid-argument', 'courseId and lessonId are required.');
    const { metadata, manifest } = await this.courseDefinition(courseId);
    if (!courseVersion || courseVersion !== metadata.version) fail('failed-precondition', 'The requested course version is not currently published.');
    const requirements = this.engine.requirements(manifest);
    if (!requirements.lessonIds.includes(lessonId)) fail('invalid-argument', 'The lesson is not part of this course version.');
    const lesson = await this.lessonDefinition(courseId, manifest, metadata, lessonId);
    if (!evidence?.sessionId) fail('failed-precondition', 'A server-issued lesson evidence session is required.');
    const reference = this.db.doc(trustedProgressPath(uid, courseId));
    const sessionReference = this.db.doc(evidencePath(uid, evidence.sessionId));
    const nowMs = this.clock(); const now = Timestamp.fromMillis(nowMs);
    const result = await this.db.runTransaction(async (transaction) => {
      const [snapshot, sessionSnapshot] = await Promise.all([transaction.get(reference), transaction.get(sessionReference)]);
      if (!sessionSnapshot.exists) fail('not-found', 'Lesson evidence session was not found.');
      const session = sessionSnapshot.data();
      if (session.ownerUid !== uid || session.courseId !== courseId || session.courseVersion !== metadata.version || session.lessonId !== lessonId) fail('permission-denied', 'Lesson evidence does not belong to this request.');
      const current = snapshot.data() ?? {};
      if (session.state === 'CONSUMED') {
        if (current.courseProgressVersion === requirements.courseProgressVersion && (current.completedLessons ?? []).includes(lessonId)) return current;
        fail('failed-precondition', 'Lesson evidence session has already been consumed.');
      }
      const validated = this.validateEvidence(session, lesson, evidence, nowMs);
      const completedLessons = [...new Set([...(current.completedLessons ?? []), lessonId])]
        .filter((id) => requirements.lessonIds.includes(id));
      const record = {
        courseId,
        courseProgressVersion: requirements.courseProgressVersion,
        completedLessons,
        lessonEvidence: {
          ...(current.lessonEvidence ?? {}),
          [lessonId]: { ...validated, courseVersion: metadata.version, completedAt: now },
        },
        updatedAt: now,
        schemaVersion: '2.0.0',
      };
      transaction.set(reference, record);
      transaction.update(sessionReference, { state: 'CONSUMED', consumedAt: now });
      return record;
    });
    return this.engine.evaluate(manifest, result);
  }

  async evaluateEligibility(uid, courseId) {
    const [manifest, progressSnapshot] = await Promise.all([
      this.manifest(courseId),
      this.db.doc(trustedProgressPath(uid, courseId)).get(),
    ]);
    const evaluation = this.engine.evaluate(manifest, progressSnapshot.data());
    return { ...evaluation, eligibilityPolicyVersion: CERTIFICATION_POLICY.eligibilityPolicyVersion };
  }
}
