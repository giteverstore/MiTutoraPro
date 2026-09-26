import { createDefaultFirestore } from '../firestore/createDefaultFirestore.js';
import { RemoteCompilerError } from './RemoteCompilerError.js';

const snapshotData = (snapshot) => snapshot?.exists ? snapshot.data() : null;
const versionedPath = (path, version) => { const index = path.lastIndexOf('/'); return `${path.slice(0, index)}/${version}/${path.slice(index + 1)}`; };
function compilerLanguages(content) { return (content?.blocks ?? []).filter((block) => block?.type === 'compiler').map((block) => String(block.language ?? block.compiler?.language ?? '').toLowerCase()); }

export class FirebaseRemoteCompilerContentAuthorizer {
  constructor({ db, loadJson, uid } = {}) { this.db = db; this.loadJson = loadJson; this.uid = uid; }
  async assertPublished(metadata) {
    if (!metadata || metadata.published !== true) throw new RemoteCompilerError('remote-compiler/content-not-found', 'The requested compiler exercise is unavailable.', { status: 404 });
    if (metadata.premium === true) {
      const entitlement = snapshotData(await this.db.doc(`users/${this.uid}/entitlements/premium`).get()); const expiresAt = entitlement?.expiresAt?.toDate?.() ?? new Date(entitlement?.expiresAt ?? 0);
      if (entitlement?.active !== true || entitlement?.tier !== 'PREMIUM' || expiresAt.getTime() <= Date.now()) throw new RemoteCompilerError('remote-compiler/content-forbidden', 'This compiler exercise is not available for this account.', { status: 403 });
    }
  }
  async resolve(contentType, contentId) {
    if (!['practice', 'challenge', 'course'].includes(contentType) || !contentId) throw new RemoteCompilerError('remote-compiler/invalid-content-reference', 'A canonical compiler content reference is required.', { status: 400 });
    if (contentType === 'practice') { const metadata = snapshotData(await this.db.doc(`practiceQuestions/${contentId}`).get()); await this.assertPublished(metadata); return this.loadJson(versionedPath(metadata.storagePath, metadata.version)); }
    if (contentType === 'challenge') { const metadata = snapshotData(await this.db.doc(`dailyChallenges/${contentId}`).get()); await this.assertPublished(metadata); if (metadata.practiceQuestionId) return this.resolve('practice', metadata.practiceQuestionId); return this.loadJson(versionedPath(metadata.storagePath, metadata.version)); }
    const separator = contentId.indexOf(':'); if (separator < 1) throw new RemoteCompilerError('remote-compiler/invalid-content-reference', 'Course content must identify a course and lesson.', { status: 400 });
    const courseId = contentId.slice(0, separator); const lessonId = contentId.slice(separator + 1); const metadata = snapshotData(await this.db.doc(`courses/${courseId}`).get()); await this.assertPublished(metadata);
    const root = `${metadata.storagePath}/${metadata.version}`; const manifest = await this.loadJson(`${root}/course.json`); const moduleIndex = (manifest.modules ?? []).findIndex((module) => (module.lessons ?? module.sections?.flatMap((section) => section.lessons ?? []) ?? []).some((lesson) => lesson.id === lessonId));
    if (moduleIndex < 0) throw new RemoteCompilerError('remote-compiler/content-not-found', 'The requested compiler exercise is unavailable.', { status: 404 });
    const module = await this.loadJson(`${root}/module-${moduleIndex + 1}.json`); return (module.lessons ?? module.sections?.flatMap((section) => section.lessons ?? []) ?? []).find((lesson) => lesson.id === lessonId);
  }
  async assertAllowed({ language, contentId, contentType }) { const content = await this.resolve(contentType, contentId); if (!compilerLanguages(content).includes(language)) throw new RemoteCompilerError('remote-compiler/language-not-authorized', 'This language is not enabled for the requested exercise.', { status: 403 }); return true; }
}

export async function createFirebaseRemoteCompilerContentAuthorizer({ environment, credentials, uid }) {
  const session = await createDefaultFirestore(environment, credentials); const bucket = String(environment.FIREBASE_STORAGE_BUCKET || '').trim();
  if (!bucket || !credentials?.authClient?.request) { await session.close(); throw new RemoteCompilerError('remote-compiler/content-authority-unavailable', 'Canonical compiler content validation is not configured.', { status: 503 }); }
  const loadJson = async (path) => (await credentials.authClient.request({ url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`, responseType: 'json' })).data;
  return Object.freeze({ authorizer: new FirebaseRemoteCompilerContentAuthorizer({ db: session.db, loadJson, uid }), close: session.close });
}
