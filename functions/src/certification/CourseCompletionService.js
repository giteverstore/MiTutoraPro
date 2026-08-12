import { Timestamp } from 'firebase-admin/firestore';
import { CourseCompletionEngine } from './CourseCompletionEngine.js';
import { CERTIFICATION_POLICY } from './CertificationPolicy.js';

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
const trustedProgressPath = (uid, courseId) => `users/${uid}/trustedCourseProgress/${courseId}`;

export class CourseCompletionService {
  constructor({ db, bucket, engine = new CourseCompletionEngine() }) {
    this.db = db;
    this.bucket = bucket;
    this.engine = engine;
    this.manifestCache = new Map();
  }

  async manifest(courseId) {
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
    return this.manifestCache.get(key);
  }

  async recordLessonCompletion(uid, { courseId, lessonId, completionType = 'reading' }) {
    if (!courseId || !lessonId) fail('invalid-argument', 'courseId and lessonId are required.');
    const manifest = await this.manifest(courseId);
    const requirements = this.engine.requirements(manifest);
    if (!requirements.lessonIds.includes(lessonId)) fail('invalid-argument', 'The lesson is not part of this course version.');
    const reference = this.db.doc(trustedProgressPath(uid, courseId));
    const now = Timestamp.now();
    const result = await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = snapshot.data() ?? {};
      if (current.courseProgressVersion === requirements.courseProgressVersion && (current.completedLessons ?? []).includes(lessonId)) return current;
      const completedLessons = [...new Set([...(current.completedLessons ?? []), lessonId])]
        .filter((id) => requirements.lessonIds.includes(id));
      const record = {
        courseId,
        courseProgressVersion: requirements.courseProgressVersion,
        completedLessons,
        lessonEvidence: {
          ...(current.lessonEvidence ?? {}),
          [lessonId]: { type: ['reading', 'quiz', 'exercise'].includes(completionType) ? completionType : 'reading', completedAt: now },
        },
        updatedAt: now,
        schemaVersion: '1.0.0',
      };
      transaction.set(reference, record);
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
