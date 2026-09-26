import { MySqlExecutionError } from './MySqlExecutionError.js';
import { MySqlCanonicalSetupResolver } from './mysqlCanonicalSetupResolver.js';

function data(snapshot) { return snapshot?.exists ? snapshot.data() : null; }
function versionedPath(path, version) {
  const index = path.lastIndexOf('/');
  return `${path.slice(0, index)}/${version}/${path.slice(index + 1)}`;
}
function compilerDefinition(content) {
  const blocks = content?.blocks ?? [];
  const block = blocks.find((candidate) => candidate?.type === 'compiler');
  const language = String(block?.language ?? block?.compiler?.language ?? '').toLowerCase();
  return block ? { language, setupSql: String(block.setupSql ?? block.execution?.setupSql ?? block.compiler?.setupSql ?? '') } : null;
}

export class FirebaseMySqlContentSource {
  constructor({ db, loadJson, uid } = {}) { this.db = db; this.loadJson = loadJson; this.uid = uid; }

  async assertPublished(metadata) {
    if (!metadata || metadata.published !== true) throw new MySqlExecutionError('mysql/content-not-found', 'The requested MySQL exercise is unavailable.', { status: 404 });
    if (metadata.premium === true) {
      const entitlement = data(await this.db.doc(`users/${this.uid}/entitlements/premium`).get());
      const expiresAt = entitlement?.expiresAt?.toDate?.() ?? new Date(entitlement?.expiresAt ?? 0);
      if (entitlement?.active !== true || entitlement?.tier !== 'PREMIUM' || expiresAt.getTime() <= Date.now()) {
        throw new MySqlExecutionError('mysql/content-forbidden', 'This MySQL exercise is not available for this account.', { status: 403 });
      }
    }
  }

  async practice(id) {
    const metadata = data(await this.db.doc(`practiceQuestions/${id}`).get());
    await this.assertPublished(metadata);
    const content = await this.loadJson(versionedPath(metadata.storagePath, metadata.version));
    return { metadata, content, canonicalId: id, contentHash: metadata.contentHash ?? null };
  }

  async challenge(id) {
    const metadata = data(await this.db.doc(`dailyChallenges/${id}`).get());
    await this.assertPublished(metadata);
    if (metadata.practiceQuestionId) {
      const practice = await this.practice(metadata.practiceQuestionId);
      return { ...practice, canonicalId: id };
    }
    const content = await this.loadJson(versionedPath(metadata.storagePath, metadata.version));
    return { metadata, content, canonicalId: id, contentHash: metadata.contentHash ?? null };
  }

  async course(id) {
    const separator = id.indexOf(':');
    if (separator < 1) throw new MySqlExecutionError('mysql/invalid-content-reference', 'Course content must identify a course and lesson.', { status: 400 });
    const courseId = id.slice(0, separator);
    const lessonId = id.slice(separator + 1);
    const metadata = data(await this.db.doc(`courses/${courseId}`).get());
    await this.assertPublished(metadata);
    const root = `${metadata.storagePath}/${metadata.version}`;
    const manifest = await this.loadJson(`${root}/course.json`);
    const moduleIndex = (manifest.modules ?? []).findIndex((module) => (module.lessons ?? module.sections?.flatMap((section) => section.lessons ?? []) ?? []).some((lesson) => lesson.id === lessonId));
    if (moduleIndex < 0) throw new MySqlExecutionError('mysql/content-not-found', 'The requested MySQL exercise is unavailable.', { status: 404 });
    const module = await this.loadJson(`${root}/module-${moduleIndex + 1}.json`);
    const lessons = module.lessons ?? module.sections?.flatMap((section) => section.lessons ?? []) ?? [];
    const content = lessons.find((lesson) => lesson.id === lessonId);
    return { metadata, content, canonicalId: id, contentHash: metadata.contentIntegrity?.modules?.[`module-${moduleIndex + 1}.json`] ?? null };
  }

  async getMySqlExecutionDefinition({ contentId, contentType }) {
    const resolved = await this[contentType](contentId);
    const definition = compilerDefinition(resolved.content);
    if (!definition || definition.language !== 'mysql') return null;
    return { ...definition, canonicalId: resolved.canonicalId, contentHash: resolved.contentHash };
  }
}

export async function createFirebaseMySqlSetupResolver({ environment, credentials, uid }) {
  const { createDefaultFirestore } = await import('../firestore/createDefaultFirestore.js');
  const session = await createDefaultFirestore(environment, credentials);
  const bucket = String(environment.FIREBASE_STORAGE_BUCKET || '').trim();
  if (!bucket || !credentials?.authClient?.request) {
    await session.close();
    throw new MySqlExecutionError('mysql/content-source-unavailable', 'Canonical MySQL exercise content is not configured.', { status: 503 });
  }
  const loadJson = async (path) => {
    const response = await credentials.authClient.request({ url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`, responseType: 'json' });
    return response.data;
  };
  return Object.freeze({ resolver: new MySqlCanonicalSetupResolver({ contentSource: new FirebaseMySqlContentSource({ db: session.db, loadJson, uid }) }), close: session.close });
}

export const firebaseMySqlContentInternals = Object.freeze({ compilerDefinition, versionedPath });
