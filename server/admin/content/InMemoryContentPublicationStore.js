import { PUBLICATION_STATUS } from '../../../shared/content/index.js';
import { ContentPublicationError } from './ContentPublicationError.js';

const clone = (value) => value == null ? value : structuredClone(value);

export class InMemoryContentPublicationStore {
  constructor() { this.drafts = new Map(); this.versions = new Map(); this.pointers = new Map(); this.audit = []; }
  getDraft(id) { return clone(this.drafts.get(id) ?? null); }
  listDrafts() { return [...this.drafts.values()].map(clone); }
  listDraftSummaries({ limit = 25, cursor = null } = {}) { const values = [...this.drafts.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))); const start = cursor ? values.findIndex((item) => item.contentId === cursor) + 1 : 0; const items = values.slice(start, start + limit).map((item) => ({ contentId: item.contentId, contentType: item.contentType, title: item.document?.content?.title ?? '', draftRevision: item.draftRevision, lifecycleState: item.lifecycleState, validationSummary: clone(item.validationSummary), updatedAt: item.updatedAt, updatedBy: item.updatedBy })); return { items, nextCursor: start + limit < values.length ? items.at(-1)?.contentId : null }; }
  async createOrUpdateDraft(draft, expected) { if ((this.drafts.get(draft.contentId)?.draftRevision ?? 0) !== expected) throw new ContentPublicationError('content/draft-conflict', 'Draft revision conflict.', { status: 409 }); this.drafts.set(draft.contentId, clone(draft)); }
  async updateDraftValidation(id, revision, patch) { const value = this.drafts.get(id); if (!value || value.draftRevision !== revision) throw new ContentPublicationError('content/draft-conflict', 'Draft revision conflict.', { status: 409 }); Object.assign(value, clone(patch)); }
  async appendAudit(entry) { this.audit.push(clone(entry)); }
  async allocateVersion({ draft, actor, timestamp, expectedActiveRevision }) {
    const pointer = this.pointers.get(draft.contentId);
    const activeRevision = pointer?.activeRevision ?? 0;
    if (expectedActiveRevision != null && expectedActiveRevision !== activeRevision) throw new ContentPublicationError('content/active-conflict', 'Publication state changed elsewhere.', { status: 409 });
    const versions = this.versions.get(draft.contentId) ?? new Map();
    const version = Math.max(pointer?.latestVersion ?? 0, ...versions.keys(), 0) + 1;
    versions.set(version, { contentId: draft.contentId, version, status: PUBLICATION_STATUS.CREATING, sourceDraftRevision: draft.draftRevision, createdAt: timestamp, createdBy: actor.uid });
    this.versions.set(draft.contentId, versions);
    this.pointers.set(draft.contentId, { ...(pointer ?? {}), contentId: draft.contentId, contentType: draft.contentType, latestVersion: version, activeRevision });
    this.drafts.get(draft.contentId).lifecycleState = 'PUBLISHING';
    return { version, activeRevision };
  }
  async completePublication({ metadata, actor, timestamp, expectedActiveRevision }) {
    const pointer = this.pointers.get(metadata.contentId);
    if ((pointer?.activeRevision ?? 0) !== expectedActiveRevision) throw new ContentPublicationError('content/active-conflict', 'Publication state changed elsewhere.', { status: 409 });
    const version = this.versions.get(metadata.contentId)?.get(metadata.version);
    if (version?.status !== PUBLICATION_STATUS.CREATING) throw new ContentPublicationError('content/version-state', 'Version is not eligible for activation.', { status: 409 });
    Object.assign(version, clone(metadata));
    const active = { ...pointer, activeVersion: metadata.version, activeArtifactPath: metadata.artifactPath, activeArtifactHash: metadata.artifactHash, metadataSnapshot: metadata.metadataSnapshot, publicationStatus: 'ACTIVE', activeRevision: expectedActiveRevision + 1, updatedAt: timestamp, updatedBy: actor.uid };
    this.pointers.set(metadata.contentId, active);
    this.drafts.get(metadata.contentId).lifecycleState = 'PUBLISHED';
    await this.appendAudit({ event: 'CONTENT_PUBLISHED', actorUid: actor.uid, actorRole: actor.role, timestamp, contentId: metadata.contentId, contentType: metadata.contentType, version: metadata.version, draftRevision: metadata.sourceDraftRevision });
    await this.appendAudit({ event: 'CONTENT_ACTIVATED', actorUid: actor.uid, actorRole: actor.role, timestamp, contentId: metadata.contentId, contentType: metadata.contentType, previousActiveVersion: pointer?.activeVersion ?? null, newActiveVersion: metadata.version });
    return clone(active);
  }
  async failVersion(id, version, timestamp) { Object.assign(this.versions.get(id)?.get(version) ?? {}, { status: PUBLICATION_STATUS.FAILED, failedAt: timestamp }); }
  async activateVersion({ contentId, version, actor, timestamp, expectedActiveRevision, auditEvent }) {
    const pointer = this.pointers.get(contentId);
    if (!pointer || pointer.activeRevision !== expectedActiveRevision) throw new ContentPublicationError('content/active-conflict', 'Publication state changed elsewhere.', { status: 409 });
    const target = this.versions.get(contentId)?.get(version);
    if (!target || target.status !== PUBLICATION_STATUS.READY) throw new ContentPublicationError('content/version-not-ready', 'Only a READY version may be activated.', { status: 409 });
    const active = { ...pointer, activeVersion: version, activeArtifactPath: target.artifactPath, activeArtifactHash: target.artifactHash, metadataSnapshot: target.metadataSnapshot, publicationStatus: 'ACTIVE', activeRevision: expectedActiveRevision + 1, updatedAt: timestamp, updatedBy: actor.uid };
    this.pointers.set(contentId, active);
    await this.appendAudit({ event: auditEvent, actorUid: actor.uid, actorRole: actor.role, timestamp, contentId, contentType: target.contentType, previousActiveVersion: pointer.activeVersion, newActiveVersion: version, version });
    return clone(active);
  }
  async archiveContent({ contentId, actor, timestamp, expectedActiveRevision }) {
    const pointer = this.pointers.get(contentId);
    if (!pointer || pointer.activeRevision !== expectedActiveRevision) throw new ContentPublicationError('content/active-conflict', 'Publication state changed elsewhere.', { status: 409 });
    const archived = { ...pointer, publicationStatus: 'ARCHIVED', activeRevision: expectedActiveRevision + 1, updatedAt: timestamp, updatedBy: actor.uid };
    this.pointers.set(contentId, archived);
    await this.appendAudit({ event: 'CONTENT_ARCHIVED', actorUid: actor.uid, actorRole: actor.role, timestamp, contentId, contentType: pointer.contentType, version: pointer.activeVersion });
    return clone(archived);
  }
  listVersions(id) { return [...(this.versions.get(id)?.values() ?? [])].sort((a, b) => b.version - a.version).map(clone); }
  getPointer(id) { return clone(this.pointers.get(id) ?? null); }
  listPointers({ limit = 25, cursor = null } = {}) { const values = [...this.pointers.values()].sort((a, b) => a.contentId.localeCompare(b.contentId)); const start = cursor ? values.findIndex((item) => item.contentId === cursor) + 1 : 0; const items = values.slice(start, start + limit).map((pointer) => { const version = this.versions.get(pointer.contentId)?.get(pointer.activeVersion); return { ...clone(pointer), publishedAt: version?.publishedAt ?? null, publishedBy: version?.publishedBy ?? null, sourceDraftRevision: version?.sourceDraftRevision ?? null }; }); return { items, nextCursor: start + limit < values.length ? items.at(-1)?.contentId : null }; }
  listActivePointers(contentType) { return [...this.pointers.values()].filter((pointer) => pointer.publicationStatus === 'ACTIVE' && (!contentType || pointer.contentType === contentType)).map(clone); }
  getVersion(id, version) { return clone(this.versions.get(id)?.get(Number(version)) ?? null); }
}

export class InMemoryArtifactStore {
  constructor() { this.files = new Map(); }
  async createImmutable(path, bytes) { if (this.files.has(path)) throw new Error('Artifact already exists.'); this.files.set(path, Buffer.from(bytes)); }
  async read(path) { const value = this.files.get(path); if (!value) throw new Error('Artifact not found.'); return Buffer.from(value); }
  async markReady() {}
}
