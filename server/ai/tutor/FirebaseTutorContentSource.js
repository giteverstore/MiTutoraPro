import { createHash } from 'node:crypto';
import { AIServiceError } from '../AIServiceError.js';
import { createDefaultFirestore } from '../../firestore/createDefaultFirestore.js';
import { attachTutorContentFailure } from './tutorContentDiagnostics.js';

const LEGACY_COURSES = new Set(['python', 'java']);
const SHA256 = /^[a-f0-9]{64}$/u;
const VERSION = /^v[1-9]\d*$/u;
const STORAGE_PATH = /^[a-z0-9][a-z0-9._/-]*\.json$/u;
const MAX_COURSE_MANIFEST_BYTES = 1024 * 1024;
const MAX_PRACTICE_BYTES = 512 * 1024;

const unavailable = (reason, cause) => attachTutorContentFailure(
  new AIServiceError('ai/content-unavailable', 'The requested learning content is unavailable.', { status: 503, cause }),
  reason,
);
const data = (snapshot) => snapshot?.exists ? snapshot.data() : null;
const lessons = (course) => (course?.modules ?? []).flatMap((module) => module.sections?.flatMap((section) => section.lessons ?? []) ?? module.lessons ?? []);
const moduleLessons = (module) => module?.sections?.flatMap((section) => section.lessons ?? []) ?? module?.lessons ?? [];

function versionedPath(path, version) {
  const normalized = String(path ?? '');
  const index = normalized.lastIndexOf('/');
  if (index < 1 || !VERSION.test(version)) throw unavailable('version-invalid');
  const result = `${normalized.slice(0, index)}/${version}/${normalized.slice(index + 1)}`;
  if (!STORAGE_PATH.test(result) || result.includes('..')) throw unavailable('metadata-identity-mismatch');
  return result;
}

function assertHash(value) {
  const hash = String(value ?? '').toLowerCase();
  if (!SHA256.test(hash)) throw unavailable('integrity-mismatch');
  return hash;
}

function parseVerifiedJson(bytes, expectedHash, maxBytes, malformedReason = 'manifest-read-failed') {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (!buffer.length || buffer.byteLength > maxBytes) throw unavailable(malformedReason);
  if (expectedHash != null && expectedHash !== ''
    && createHash('sha256').update(buffer).digest('hex') !== assertHash(expectedHash)) throw unavailable('integrity-mismatch');
  try {
    const value = JSON.parse(buffer.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid content');
    return value;
  } catch (cause) {
    throw unavailable(malformedReason, cause);
  }
}

function record(snapshot, reference) {
  const path = String(reference?.path ?? '');
  return Object.freeze({ id: String(snapshot?.id ?? path.slice(path.lastIndexOf('/') + 1)), value: data(snapshot) });
}

function validCourseManifest(manifest, metadata) {
  const expectedFiles = Array.from({ length: metadata.moduleCount }, (_, index) => `module-${index + 1}.json`);
  return manifest.id === metadata.id
    && Array.isArray(manifest.moduleFiles)
    && JSON.stringify(manifest.moduleFiles) === JSON.stringify(expectedFiles)
    && Array.isArray(manifest.modules)
    && manifest.modules.length === metadata.moduleCount
    && manifest.modules.every((module) => moduleLessons(module).length > 0)
    && manifest.modules.every((module) => moduleLessons(module).every((lesson) => typeof lesson?.id === 'string'
      && Array.isArray(lesson.blocks) && lesson.blocks.length === 0));
}

function storageFailure(error) {
  const status = Number(error?.response?.status ?? error?.code);
  if (status === 403) return 'storage-read-denied';
  if (status === 404) return 'storage-object-missing';
  return 'manifest-read-failed';
}

export class FirebaseTutorContentSource {
  constructor({ db, loadBytes } = {}) {
    if (!db?.doc || typeof loadBytes !== 'function') throw new TypeError('Firebase Tutor content source requires Firestore and Storage readers.');
    this.db = db;
    this.loadBytes = loadBytes;
  }

  async records(paths) {
    const references = paths.map((path) => this.db.doc(path));
    try {
      const snapshots = typeof this.db.getAll === 'function'
        ? await this.db.getAll(...references)
        : await Promise.all(references.map((reference) => reference.get()));
      return snapshots.map((snapshot, index) => record(snapshot, references[index]));
    } catch (cause) {
      throw unavailable('metadata-read-failed', cause);
    }
  }

  async course(contentId, signal) {
    if (!LEGACY_COURSES.has(contentId)) throw unavailable('publication-not-found');
    const [{ id: metadataId, value: metadata }] = await this.records([`courses/${contentId}`]);
    if (!metadata || metadata.published !== true) throw unavailable('publication-not-found');
    if (!VERSION.test(metadata.version)) throw unavailable('version-invalid');
    if (metadataId !== contentId || metadata.id !== contentId || metadata.storagePath !== `course-content/${contentId}`
      || !Number.isSafeInteger(metadata.moduleCount) || metadata.moduleCount < 1) throw unavailable('metadata-identity-mismatch');
    if (metadata.contentIntegrity != null && metadata.contentIntegrity.algorithm !== 'sha256') throw unavailable('integrity-mismatch');
    const path = `${metadata.storagePath}/${metadata.version}/course.json`;
    if (!STORAGE_PATH.test(path) || path.includes('..')) throw unavailable('metadata-identity-mismatch');
    let bytes;
    try { bytes = await this.loadBytes(path, { signal }); }
    catch (cause) {
      if (cause?.tutorContentFailureReason) throw cause;
      throw unavailable(storageFailure(cause), cause);
    }
    const manifest = parseVerifiedJson(bytes, metadata.contentIntegrity?.manifest, MAX_COURSE_MANIFEST_BYTES);
    if (!validCourseManifest(manifest, metadata) || lessons(manifest).some((lesson) => typeof lesson?.id !== 'string')) throw unavailable('content-identity-mismatch');
    return Object.freeze({
      contentSource: 'legacy-course', contentId, contentType: 'COURSE', version: metadata.version,
      content: Object.freeze({ ...manifest, courseId: manifest.id }),
    });
  }

  async practice(contentId, signal) {
    const [publicationRecord, metadataRecord] = await this.records(['contentPublications/practice-python', `practiceQuestions/${contentId}`]);
    const publication = publicationRecord.value;
    const metadata = metadataRecord.value;
    if (!publication || publication.status !== 'ACTIVE' || publication.integrityRequired !== true) throw unavailable('publication-not-found');
    if (!VERSION.test(publication.activeVersion) || !metadata || !VERSION.test(metadata.version)
      || metadata.version !== publication.activeVersion) throw unavailable(metadata ? 'version-invalid' : 'practice-question-not-found');
    if (metadataRecord.id !== contentId || (metadata.id != null && metadata.id !== contentId)) throw unavailable('metadata-identity-mismatch');
    if (metadata.published !== true) throw unavailable('practice-question-not-found');
    const path = versionedPath(metadata.storagePath, metadata.version);
    let bytes;
    try { bytes = await this.loadBytes(path, { signal }); }
    catch (cause) {
      if (cause?.tutorContentFailureReason) throw cause;
      throw unavailable(storageFailure(cause), cause);
    }
    const question = parseVerifiedJson(bytes, metadata.contentHash, MAX_PRACTICE_BYTES);
    if (question.id !== contentId) throw unavailable('content-identity-mismatch');
    return Object.freeze({
      contentSource: 'firebase-practice', contentId, contentType: 'PRACTICE', version: metadata.version,
      content: Object.freeze({ ...question, questionId: question.id }),
    });
  }

  get({ surface, contentId, signal }) {
    if (surface === 'course') return this.course(contentId, signal);
    if (surface === 'practice') return this.practice(contentId, signal);
    throw unavailable('publication-not-found');
  }
}

export async function createFirebaseTutorContentSource({ environment = process.env, credentials } = {}) {
  const bucket = String(environment.FIREBASE_STORAGE_BUCKET ?? '').trim();
  if (!bucket || !credentials?.authClient?.request) throw unavailable('fallback-config-missing');
  let session;
  try { session = await createDefaultFirestore(environment, credentials); }
  catch (cause) { throw unavailable('metadata-read-failed', cause); }
  const loadBytes = async (path, { signal } = {}) => {
    try {
      const response = await credentials.authClient.request({
        url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`,
        responseType: 'arraybuffer', signal,
      });
      return Buffer.from(response.data);
    } catch (cause) {
      throw unavailable(storageFailure(cause), cause);
    }
  };
  return Object.freeze({ source: new FirebaseTutorContentSource({ db: session.db, loadBytes }), close: session.close });
}

export const firebaseTutorContentInternals = Object.freeze({ LEGACY_COURSES, parseVerifiedJson, storageFailure, versionedPath });
