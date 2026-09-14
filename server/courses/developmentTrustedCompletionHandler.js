import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Timestamp } from 'firebase-admin/firestore';
import { firebaseAITutorAuthenticator } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createDefaultFirestore } from '../firestore/createDefaultFirestore.js';

const SOURCES = Object.freeze({
  python: Object.freeze({
    course: new URL('../../public/courses/python-course.json', import.meta.url),
    publication: new URL('../../firebase-content/firestore/courses/python.json', import.meta.url),
  }),
  java: Object.freeze({
    course: new URL('../../public/courses/java-course.json', import.meta.url),
    publication: new URL('../../firebase-content/firestore/courses/java.json', import.meta.url),
  }),
});
const LOOPBACK = /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/;
const lessonsOf = (course) => course.modules.flatMap((module) => (module.sections ?? [{ lessons: module.lessons ?? [] }]).flatMap((section) => section.lessons ?? []));

function assertBoundary(environment) {
  if (environment.NODE_ENV === 'production' || environment.LOCAL_COIN_FULL_STACK !== 'true'
    || environment.FIREBASE_PROJECT_ID !== 'demo-mitutora-coins'
    || environment.VITE_FIREBASE_PROJECT_ID !== 'demo-mitutora-coins'
    || !LOOPBACK.test(String(environment.FIRESTORE_EMULATOR_HOST ?? ''))
    || !LOOPBACK.test(String(environment.FIREBASE_AUTH_EMULATOR_HOST ?? ''))) throw Object.assign(new Error('Not found.'), { code: 'development/not-found', status: 404 });
}

export function createDevelopmentTrustedCompletionHandler({ environment = process.env, authenticator = firebaseAITutorAuthenticator, firestoreFactory = createDefaultFirestore } = {}) {
  return async function handler(request, response) {
    let session;
    try {
      assertBoundary(environment);
      const { courseId, courseVersion, lessonId } = request.body ?? {};
      if (!SOURCES[courseId] || typeof lessonId !== 'string') throw Object.assign(new Error('Canonical course and lesson identity are required.'), { code: 'development/invalid-argument', status: 400 });
      const source = SOURCES[courseId];
      const [course, publication] = await Promise.all([
        readFile(fileURLToPath(source.course), 'utf8').then(JSON.parse),
        readFile(fileURLToPath(source.publication), 'utf8').then(JSON.parse),
      ]);
      const lessons = lessonsOf(course).filter(({ required }) => required !== false);
      const index = lessons.findIndex(({ id }) => id === lessonId);
      if (course.id !== courseId || publication.id !== courseId
        || publication.version !== courseVersion || index < 0) {
        throw Object.assign(new Error('Canonical course publication identity does not match.'), { code: 'development/identity-mismatch', status: 400 });
      }
      const credentials = Object.freeze({ mode: 'emulator', firebaseCredential: null, async preflight() {} });
      const authenticated = await authenticator.authenticate(request, { environment, googleCredentials: credentials });
      session = await firestoreFactory(environment, credentials);
      const reference = session.db.doc(`users/${authenticated.uid}/trustedCourseProgress/${courseId}`);
      const result = await session.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        const current = snapshot.data() ?? {};
        const completed = new Set(current.completedLessons ?? []);
        if (completed.has(lessonId)) {
          const completedCount = lessons.filter(({ id }) => completed.has(id)).length;
          return { completed: completedCount, total: lessons.length, eligibilityStatus: completedCount === lessons.length ? 'ELIGIBLE' : 'LOCKED' };
        }
        if (!completed.has(lessonId) && lessons.slice(0, index).some(({ id }) => !completed.has(id))) throw Object.assign(new Error('Complete trusted lessons in canonical order.'), { code: 'development/progression-precondition', status: 409 });
        completed.add(lessonId);
        const now = Timestamp.now();
        const completedLessons = lessons.map(({ id }) => id).filter((id) => completed.has(id));
        const record = {
          courseId, courseProgressVersion: course.metadata?.version ?? course.schemaVersion,
          completedLessons,
          lessonEvidence: { ...(current.lessonEvidence ?? {}), [lessonId]: { type: 'development', assurance: 'PROTOCOL_OBSERVED', sessionId: `development-${lessonId}`, courseVersion, completedAt: now } },
          updatedAt: now, schemaVersion: '2.0.0',
        };
        transaction.set(reference, record, { merge: false });
        return { completed: completedLessons.length, total: lessons.length, eligibilityStatus: completedLessons.length === lessons.length ? 'ELIGIBLE' : 'LOCKED' };
      });
      return response.status(200).json(result);
    } catch (error) {
      const auth = ['ai/auth-required', 'ai/auth-invalid'].includes(error?.code);
      return response.status(auth ? 401 : error.status ?? 500).json({ error: { code: auth ? 'development/unauthenticated' : error.code ?? 'development/internal', message: auth ? 'Sign in with the local emulator first.' : error.message } });
    } finally { await session?.close(); }
  };
}
