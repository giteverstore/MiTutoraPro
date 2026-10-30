import { createHash } from 'node:crypto';
import { AIServiceError } from '../AIServiceError.js';
import { createDefaultFirestore } from '../../firestore/createDefaultFirestore.js';

const LEGACY_COURSES = new Set(['python', 'java']);
const SHA256 = /^[a-f0-9]{64}$/u;
const VERSION = /^v[1-9]\d*$/u;
const STORAGE_PATH = /^[a-z0-9][a-z0-9._/-]*\.json$/u;
const MAX_COURSE_MANIFEST_BYTES = 1024 * 1024;
const MAX_PRACTICE_BYTES = 512 * 1024;

const unavailable = (message = 'The requested learning content is unavailable.') => new AIServiceError('ai/content-unavailable', message, { status: 503 });
const data = (snapshot) => snapshot?.exists ? snapshot.data() : null;
const lessons = (course) => (course?.modules ?? []).flatMap((module) => module.sections?.flatMap((section) => section.lessons ?? []) ?? module.lessons ?? []);

function versionedPath(path, version) {
  const normalized = String(path ?? '');
  const index = normalized.lastIndexOf('/');
  if (index < 1 || !VERSION.test(version)) throw unavailable();
  const result = `${normalized.slice(0, index)}/${version}/${normalized.slice(index + 1)}`;
  if (!STORAGE_PATH.test(result) || result.includes('..')) throw unavailable();
  return result;
}

function assertHash(value) {
  const hash = String(value ?? '').toLowerCase();
  if (!SHA256.test(hash)) throw unavailable();
  return hash;
}

function parseVerifiedJson(bytes, expectedHash, maxBytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (!buffer.length || buffer.byteLength > maxBytes) throw unavailable();
  if (createHash('sha256').update(buffer).digest('hex') !== assertHash(expectedHash)) throw unavailable();
  try {
    const value = JSON.parse(buffer.toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid content');
    return value;
  } catch (cause) {
    throw new AIServiceError('ai/content-unavailable', 'The requested learning content is unavailable.', { status: 503, cause });
  }
}

export class FirebaseTutorContentSource {
  constructor({ db, loadBytes } = {}) {
    if (!db?.doc || typeof loadBytes !== 'function') throw new TypeError('Firebase Tutor content source requires Firestore and Storage readers.');
    this.db = db;
    this.loadBytes = loadBytes;
  }

  async records(paths) {
    const references = paths.map((path) => this.db.doc(path));
    const snapshots = typeof this.db.getAll === 'function'
      ? await this.db.getAll(...references)
      : await Promise.all(references.map((reference) => reference.get()));
    return snapshots.map(data);
  }

  async course(contentId, signal) {
    if (!LEGACY_COURSES.has(contentId)) throw unavailable();
    const [publication, metadata] = await this.records([`contentPublications/course-${contentId}`, `courses/${contentId}`]);
    if (publication?.status !== 'ACTIVE' || publication.integrityRequired !== true || !VERSION.test(publication.activeVersion)
      || metadata?.published !== true || metadata.id !== contentId || metadata.version !== publication.activeVersion
      || metadata.contentIntegrity?.algorithm !== 'sha256') throw unavailable();
    const path = `${metadata.storagePath}/${metadata.version}/course.json`;
    if (!STORAGE_PATH.test(path) || path.includes('..')) throw unavailable();
    const manifest = parseVerifiedJson(await this.loadBytes(path, { signal }), metadata.contentIntegrity.manifest, MAX_COURSE_MANIFEST_BYTES);
    if (manifest.id !== contentId || !Array.isArray(manifest.modules) || lessons(manifest).some((lesson) => typeof lesson?.id !== 'string')) throw unavailable();
    return Object.freeze({
      contentSource: 'legacy-course', contentId, contentType: 'COURSE', version: metadata.version,
      content: Object.freeze({ ...manifest, courseId: manifest.id }),
    });
  }

  async practice(contentId, signal) {
    const [publication, metadata] = await this.records(['contentPublications/practice-python', `practiceQuestions/${contentId}`]);
    if (publication?.status !== 'ACTIVE' || publication.integrityRequired !== true || !VERSION.test(publication.activeVersion)
      || metadata?.published !== true || metadata.id !== contentId || metadata.version !== publication.activeVersion) throw unavailable();
    const path = versionedPath(metadata.storagePath, metadata.version);
    const question = parseVerifiedJson(await this.loadBytes(path, { signal }), metadata.contentHash, MAX_PRACTICE_BYTES);
    if (question.id !== contentId) throw unavailable();
    return Object.freeze({
      contentSource: 'firebase-practice', contentId, contentType: 'PRACTICE', version: metadata.version,
      content: Object.freeze({ ...question, questionId: question.id }),
    });
  }

  get({ surface, contentId, signal }) {
    if (surface === 'course') return this.course(contentId, signal);
    if (surface === 'practice') return this.practice(contentId, signal);
    throw unavailable();
  }
}

export async function createFirebaseTutorContentSource({ environment = process.env, credentials } = {}) {
  const session = await createDefaultFirestore(environment, credentials);
  const bucket = String(environment.FIREBASE_STORAGE_BUCKET ?? '').trim();
  if (!bucket || !credentials?.authClient?.request) {
    await session.close();
    throw unavailable();
  }
  const loadBytes = async (path, { signal } = {}) => {
    const response = await credentials.authClient.request({
      url: `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`,
      responseType: 'arraybuffer', signal,
    });
    return Buffer.from(response.data);
  };
  return Object.freeze({ source: new FirebaseTutorContentSource({ db: session.db, loadBytes }), close: session.close });
}

export const firebaseTutorContentInternals = Object.freeze({ LEGACY_COURSES, parseVerifiedJson, versionedPath });
