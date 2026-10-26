import { createHash } from 'node:crypto';
import { normalizeContent, safeContentId } from '../../../shared/content/index.js';
import { ContentPublicationError } from './ContentPublicationError.js';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export class PublishedContentService {
  constructor({ store, artifacts, externalVersionReader = null, legacyVersionReader = null }) { this.store = store; this.artifacts = artifacts; this.externalVersionReader = externalVersionReader; this.legacyVersionReader = legacyVersionReader; }
  async resolveActive(contentId) {
    const id = safeContentId(contentId);
    const pointer = await this.store.getPointer(id);
    if (!pointer || pointer.publicationStatus !== 'ACTIVE' || !pointer.activeVersion) return null;
    return this.fetchVersion(id, pointer.activeVersion);
  }
  async listActiveProjects() {
    return this.listActive('PROJECT');
  }
  async listActive(contentType) {
    const pointers = await this.store.listActivePointers(contentType);
    return pointers.map(({ contentId, activeVersion, metadataSnapshot, updatedAt }) => ({ contentId, activeVersion, metadata: metadataSnapshot ?? {}, updatedAt }));
  }
  async fetchVersionSummary(contentId, version) {
    const id = safeContentId(contentId);
    const expectedVersion = Number(version);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new ContentPublicationError('content/version-invalid', 'Content version is invalid.', { status: 400 });
    const metadata = await this.store.getVersion(id, expectedVersion);
    if (!metadata || metadata.status !== 'READY') throw new ContentPublicationError('content/version-not-found', 'Published content version was not found.', { status: 404 });
    return { contentId: id, contentType: metadata.contentType, version: expectedVersion, metadata: metadata.metadataSnapshot ?? {} };
  }
  async fetchVersion(contentId, version) {
    const id = safeContentId(contentId);
    const expectedVersion = Number(version);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new ContentPublicationError('content/version-invalid', 'Content version is invalid.', { status: 400 });
    const metadata = await this.store.getVersion(id, expectedVersion);
    if (!metadata || metadata.status !== 'READY') throw new ContentPublicationError('content/version-not-found', 'Published content version was not found.', { status: 404 });
    if (!metadata.artifactBucket && this.legacyVersionReader) return this.legacyVersionReader(id, expectedVersion, metadata);
    if (metadata.artifactBucket && metadata.artifactBucket !== this.artifacts.bucketName) {
      if (!this.externalVersionReader) throw new ContentPublicationError('content/artifact-unavailable', 'Published content is temporarily unavailable.', { status: 503 });
      return this.externalVersionReader(id, expectedVersion, metadata);
    }
    let bytes;
    try { bytes = await this.artifacts.read(metadata.artifactPath); } catch (cause) { throw new ContentPublicationError('content/artifact-unavailable', 'Published content is temporarily unavailable.', { status: 503, cause }); }
    if (digest(bytes) !== metadata.artifactHash) throw new ContentPublicationError('content/artifact-corrupt', 'Published content failed its integrity check.', { status: 503 });
    let parsed;
    try { parsed = JSON.parse(bytes.toString('utf8')); } catch (cause) { throw new ContentPublicationError('content/artifact-corrupt', 'Published content is malformed.', { status: 503, cause }); }
    if (parsed.contentId !== id || parsed.version !== expectedVersion || parsed.schemaVersion !== metadata.schemaVersion) throw new ContentPublicationError('content/artifact-corrupt', 'Published content identity does not match its metadata.', { status: 503 });
    try { return { document: normalizeContent(parsed), metadata }; } catch (cause) { throw new ContentPublicationError('content/artifact-corrupt', 'Published content did not pass validation.', { status: 503, cause }); }
  }
}
