import { PUBLICATION_STATUS } from '../../../shared/content/index.js';
import { FieldPath } from 'firebase-admin/firestore';
import { ContentPublicationError } from './ContentPublicationError.js';

const draftRef = (db, id) => db.collection('adminContentDrafts').doc(id);
const pointerRef = (db, id) => db.collection('publishedContent').doc(id);
const versionRef = (db, id, version) => pointerRef(db, id).collection('versions').doc(String(version));
const courseModuleRef = (db, id, moduleId) => draftRef(db, id).collection('courseModules').doc(moduleId);

function segmentCourseDraft(draft) {
  // Firestore rejects arrays nested inside arrays. Practice public-test arguments
  // legitimately contain these, so store their already size-checked JSON verbatim.
  if (draft.contentType === 'PRACTICE') { const { document, ...header } = draft; return { root: { ...header, serializedPracticeDraft: true, documentJson: JSON.stringify(document) }, modules: [] }; }
  if (draft.contentType !== 'COURSE') return { root: draft, modules: [] };
  const modules = draft.document?.content?.modules ?? [];
  return {
    root: { ...draft, segmentedCourseDraft: true, courseModuleIds: modules.map(({ id }) => id), document: { ...draft.document, content: { ...draft.document.content, modules: [] } } },
    modules,
  };
}

async function hydrateCourseDraft(snapshot) {
  if (!snapshot.exists) return null;
  const root = snapshot.data();
  if (root.serializedPracticeDraft) { const { documentJson, ...header } = root; return { ...header, document: JSON.parse(documentJson) }; }
  if (!root.segmentedCourseDraft) return root;
  const ids = root.courseModuleIds ?? [];
  const modules = await Promise.all(ids.map(async (id) => (await courseModuleRef(snapshot.ref.firestore, root.contentId, id).get()).data()?.module));
  return { ...root, document: { ...root.document, content: { ...root.document.content, modules: modules.filter(Boolean) } } };
}

export class FirebaseContentPublicationStore {
  constructor(db) { this.db = db; }
  async getDraft(id) { return hydrateCourseDraft(await draftRef(this.db, id).get()); }
  async listDrafts() {
    const snapshots = [];
    let cursor = null;
    do {
      let query = this.db.collection('adminContentDrafts').orderBy('updatedAt', 'desc').limit(100);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      snapshots.push(...page.docs);
      cursor = page.docs.length === 100 ? page.docs.at(-1) : null;
    } while (cursor);
    return Promise.all(snapshots.map(hydrateCourseDraft));
  }
  async listDraftSummaries({ limit = 25, cursor = null } = {}) {
    let query = this.db.collection('adminContentDrafts').orderBy('updatedAt', 'desc').limit(limit);
    if (cursor) {
      const previous = await draftRef(this.db, cursor).get();
      if (!previous.exists) throw new ContentPublicationError('content/cursor-invalid', 'The page cursor is no longer available.', { status: 400 });
      query = query.startAfter(previous);
    }
    const page = await query.get();
    return { items: page.docs.map((doc) => { const value = doc.data(); return { contentId: value.contentId, contentType: value.contentType, draftRevision: value.draftRevision, lifecycleState: value.lifecycleState, validationSummary: value.validationSummary ?? null, updatedAt: value.updatedAt, updatedBy: value.updatedBy, title: value.document?.content?.title ?? '' }; }), nextCursor: page.docs.length === limit ? page.docs.at(-1).id : null };
  }
  async createOrUpdateDraft(draft, expected) { const { root, modules } = segmentCourseDraft(draft); await this.db.runTransaction(async (tx) => { const ref = draftRef(this.db, draft.contentId); const snapshot = await tx.get(ref); const previous = snapshot.exists ? snapshot.data() : null; if ((previous?.draftRevision ?? 0) !== expected) throw new ContentPublicationError('content/draft-conflict', 'This draft was updated elsewhere. Reload the latest version before saving.', { status: 409 }); tx.set(ref, root); modules.forEach((module) => tx.set(courseModuleRef(this.db, draft.contentId, module.id), { module, draftRevision: draft.draftRevision })); (previous?.courseModuleIds ?? []).filter((id) => !modules.some((module) => module.id === id)).forEach((id) => tx.delete(courseModuleRef(this.db, draft.contentId, id))); }); }
  async updateDraftValidation(id, revision, patch) { await this.db.runTransaction(async (tx) => { const ref = draftRef(this.db, id); const snapshot = await tx.get(ref); if (!snapshot.exists || snapshot.data().draftRevision !== revision) throw new ContentPublicationError('content/draft-conflict', 'Draft revision conflict.', { status: 409 }); tx.update(ref, patch); }); }
  async deleteDraft({ contentId, contentType, expectedRevision, actor, timestamp }) { await this.db.runTransaction(async (tx) => { const ref = draftRef(this.db, contentId); const snapshot = await tx.get(ref); const draft = snapshot.data(); if (!draft || draft.draftRevision !== expectedRevision || draft.contentType !== contentType || draft.lifecycleState === 'PUBLISHING') throw new ContentPublicationError('content/draft-conflict', 'Draft revision conflict.', { status: 409 }); for (const id of draft.courseModuleIds ?? []) tx.delete(courseModuleRef(this.db, contentId, id)); tx.delete(ref); tx.create(this.db.collection('adminContentAudit').doc(), { event: 'DRAFT_DELETED', actorUid: actor.uid, actorRole: actor.role, timestamp, contentId, contentType, draftRevision: expectedRevision }); }); }
  appendAudit(entry) { return this.db.collection('adminContentAudit').doc(entry.eventId).create(entry); }
  async allocateVersion({ draft, actor, timestamp, expectedActiveRevision }) { return this.db.runTransaction(async (tx) => { const ref = pointerRef(this.db, draft.contentId); const snapshot = await tx.get(ref); const pointer = snapshot.exists ? snapshot.data() : {}; const activeRevision = pointer.activeRevision ?? 0; if (expectedActiveRevision != null && activeRevision !== expectedActiveRevision) throw new ContentPublicationError('content/active-conflict', 'Publication state changed elsewhere.', { status: 409 }); const version = (pointer.latestVersion ?? 0) + 1; tx.set(versionRef(this.db, draft.contentId, version), { contentId: draft.contentId, contentType: draft.contentType, version, status: PUBLICATION_STATUS.CREATING, sourceDraftRevision: draft.draftRevision, createdAt: timestamp, createdBy: actor.uid }); tx.set(ref, { ...pointer, contentId: draft.contentId, contentType: draft.contentType, latestVersion: version, activeRevision }, { merge: true }); tx.update(draftRef(this.db, draft.contentId), { lifecycleState: 'PUBLISHING' }); return { version, activeRevision }; }); }
  async completePublication({ metadata, actor, timestamp, expectedActiveRevision }) { return this.db.runTransaction(async (tx) => { const ref = pointerRef(this.db, metadata.contentId); const vref = versionRef(this.db, metadata.contentId, metadata.version); const [pointerSnapshot, versionSnapshot] = await Promise.all([tx.get(ref), tx.get(vref)]); const pointer = pointerSnapshot.data() ?? {}; if ((pointer.activeRevision ?? 0) !== expectedActiveRevision) throw new ContentPublicationError('content/active-conflict', 'Publication state changed elsewhere.', { status: 409 }); if (!versionSnapshot.exists || versionSnapshot.data().status !== PUBLICATION_STATUS.CREATING) throw new ContentPublicationError('content/version-state', 'Version is not eligible for activation.', { status: 409 }); const active = { ...pointer, activeVersion: metadata.version, activeArtifactPath: metadata.artifactPath, activeArtifactHash: metadata.artifactHash, metadataSnapshot: metadata.metadataSnapshot, publicationStatus: 'ACTIVE', activeRevision: expectedActiveRevision + 1, updatedAt: timestamp, updatedBy: actor.uid }; tx.set(vref, metadata); tx.set(ref, active); tx.update(draftRef(this.db, metadata.contentId), { lifecycleState: 'PUBLISHED' }); const audits = [['CONTENT_PUBLISHED', pointer.activeVersion ?? null], ['CONTENT_ACTIVATED', pointer.activeVersion ?? null]]; for (const [event, previous] of audits) tx.create(this.db.collection('adminContentAudit').doc(), { event, actorUid: actor.uid, actorRole: actor.role, timestamp, contentId: metadata.contentId, contentType: metadata.contentType, version: metadata.version, draftRevision: metadata.sourceDraftRevision, previousActiveVersion: previous, newActiveVersion: metadata.version }); return active; }); }
  async failPublication({ contentId, version, sourceDraftRevision, expectedActiveRevision, timestamp }) {
    await this.db.runTransaction(async (tx) => {
      const vref = versionRef(this.db, contentId, version);
      const pref = pointerRef(this.db, contentId);
      const dref = draftRef(this.db, contentId);
      const [versionSnapshot, pointerSnapshot, draftSnapshot] = await Promise.all([
        tx.get(vref), tx.get(pref), tx.get(dref),
      ]);
      const failedVersion = versionSnapshot.data();
      if (failedVersion?.status !== PUBLICATION_STATUS.CREATING
        || failedVersion.sourceDraftRevision !== sourceDraftRevision) return;
      tx.update(vref, { status: PUBLICATION_STATUS.FAILED, failedAt: timestamp });
      const pointer = pointerSnapshot.data();
      const draft = draftSnapshot.data();
      if (pointer?.latestVersion === version
        && (pointer.activeRevision ?? 0) === expectedActiveRevision
        && pointer.activeVersion !== version
        && draft?.draftRevision === sourceDraftRevision
        && draft.lifecycleState === 'PUBLISHING') {
        tx.update(dref, { lifecycleState: draft.validationSummary?.valid === true ? 'VALIDATED' : 'DRAFT' });
      }
    });
  }
  async activateVersion({ contentId, version, actor, timestamp, expectedActiveRevision, auditEvent }) { return this.db.runTransaction(async (tx) => { const ref = pointerRef(this.db, contentId); const vref = versionRef(this.db, contentId, version); const [pointerSnapshot, versionSnapshot] = await Promise.all([tx.get(ref), tx.get(vref)]); const pointer = pointerSnapshot.data(); const target = versionSnapshot.data(); if (!pointer || pointer.activeRevision !== expectedActiveRevision) throw new ContentPublicationError('content/active-conflict', 'Publication state changed elsewhere.', { status: 409 }); if (!target || target.status !== PUBLICATION_STATUS.READY) throw new ContentPublicationError('content/version-not-ready', 'Only a READY version may be activated.', { status: 409 }); const active = { ...pointer, activeVersion: version, activeArtifactPath: target.artifactPath, activeArtifactHash: target.artifactHash, metadataSnapshot: target.metadataSnapshot, publicationStatus: 'ACTIVE', activeRevision: expectedActiveRevision + 1, updatedAt: timestamp, updatedBy: actor.uid }; tx.set(ref, active); tx.create(this.db.collection('adminContentAudit').doc(), { event: auditEvent, actorUid: actor.uid, actorRole: actor.role, timestamp, contentId, contentType: target.contentType, version, previousActiveVersion: pointer.activeVersion, newActiveVersion: version }); return active; }); }
  async archiveContent({ contentId, actor, timestamp, expectedActiveRevision }) { return this.db.runTransaction(async (tx) => { const ref = pointerRef(this.db, contentId); const snapshot = await tx.get(ref); const pointer = snapshot.data(); if (!pointer || pointer.activeRevision !== expectedActiveRevision) throw new ContentPublicationError('content/active-conflict', 'Publication state changed elsewhere.', { status: 409 }); const archived = { ...pointer, publicationStatus: 'ARCHIVED', activeRevision: expectedActiveRevision + 1, updatedAt: timestamp, updatedBy: actor.uid }; tx.set(ref, archived); tx.create(this.db.collection('adminContentAudit').doc(), { event: 'CONTENT_ARCHIVED', actorUid: actor.uid, actorRole: actor.role, timestamp, contentId, contentType: pointer.contentType, version: pointer.activeVersion }); return archived; }); }
  async listVersions(id) { return (await pointerRef(this.db, id).collection('versions').orderBy('version', 'desc').limit(100).get()).docs.map((doc) => doc.data()); }
  async getPointer(id) { const snapshot = await pointerRef(this.db, id).get(); return snapshot.exists ? snapshot.data() : null; }
  async listPointers({ limit = 25, cursor = null } = {}) {
    let query = this.db.collection('publishedContent').orderBy(FieldPath.documentId()).limit(limit);
    if (cursor) {
      const previous = await pointerRef(this.db, cursor).get();
      if (!previous.exists) throw new ContentPublicationError('content/cursor-invalid', 'The page cursor is no longer available.', { status: 400 });
      query = query.startAfter(previous);
    }
    const page = await query.get();
    const items = await Promise.all(page.docs.map(async (doc) => {
      const pointer = doc.data();
      if (!pointer.activeVersion) return pointer;
      const version = await this.getVersion(pointer.contentId, pointer.activeVersion);
      return { ...pointer, publishedAt: version?.publishedAt ?? null, publishedBy: version?.publishedBy ?? null, sourceDraftRevision: version?.sourceDraftRevision ?? null };
    }));
    return { items, nextCursor: page.docs.length === limit ? page.docs.at(-1).id : null };
  }
  async listActivePointers(contentType) { let query = this.db.collection('publishedContent').where('publicationStatus', '==', 'ACTIVE'); if (contentType) query = query.where('contentType', '==', contentType); return (await query.limit(100).get()).docs.map((doc) => doc.data()); }
  async getVersion(id, version) { const snapshot = await versionRef(this.db, id, version).get(); return snapshot.exists ? snapshot.data() : null; }
}

const safeArtifactPath = (path) => /^published-content\/(?:projects|courses|practices|challenges)\/[a-z0-9][a-z0-9._-]{0,119}\/v[1-9]\d*\.json$/i.test(path)
  ? path : 'published-content/[invalid-path]';
const safeGoogleIdentifier = (value) => typeof value === 'string' && /^[a-z][a-z0-9._-]{0,79}$/i.test(value) ? value : null;
const safeGoogleMessage = (value) => typeof value === 'string' ? value
  .replace(/\b(?:Bearer|Basic)\s+[^\s,;]+/gi, '[redacted]')
  .replace(/\b(?:authorization|access[_ -]?token|id[_ -]?token|oidc[_ -]?token|refresh[_ -]?token|api[_ -]?key|private[_ -]?key|password)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '[redacted]')
  .replace(/\b(?:ya29\.[^\s,;]+|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+)\b/gi, '[redacted]')
  .replace(/\b[a-z0-9_-]{24,}\b/gi, '[redacted]')
  .replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ').slice(0, 300) : null;

function artifactUploadDiagnostic(bucketName, path, error) {
  let googleError;
  const body = error?.response?.body;
  if (typeof body === 'string' && body.length <= 16_000) {
    try { googleError = JSON.parse(body)?.error; } catch { /* No structured Google error body. */ }
  } else if (body && typeof body === 'object') googleError = body.error;
  const status = error?.response?.statusCode ?? error?.response?.status ?? error?.code;
  const firstDetail = Array.isArray(error?.errors) ? error.errors[0] : null;
  return {
    operation: 'admin-content-artifact-upload',
    bucket: /^[a-z0-9][a-z0-9._-]{0,221}$/i.test(bucketName) ? bucketName : '[invalid-bucket]',
    objectPath: safeArtifactPath(path),
    httpStatus: Number.isInteger(Number(status)) && Number(status) >= 100 && Number(status) <= 599 ? Number(status) : null,
    googleCode: safeGoogleIdentifier(googleError?.status) ?? (Number.isInteger(googleError?.code) ? String(googleError.code) : Number.isInteger(error?.code) ? String(error.code) : null),
    googleReason: safeGoogleIdentifier(firstDetail?.reason),
    googleMessage: safeGoogleMessage(firstDetail?.message ?? googleError?.message),
  };
}

export class FirebaseArtifactStore {
  constructor(bucket, { logger = console } = {}) { this.bucket = bucket; this.bucketName = bucket.name; this.logger = logger; }
  async createImmutable(path, bytes, metadata) {
    try {
      await this.bucket.file(path).save(bytes, { resumable: false, contentType: 'application/json', metadata: { metadata: { ...metadata, publicationState: 'CREATING' } }, preconditionOpts: { ifGenerationMatch: 0 } });
    } catch (error) {
      try { this.logger.error(JSON.stringify(artifactUploadDiagnostic(this.bucketName, path, error))); } catch { /* Logging must not replace the upload failure. */ }
      throw error;
    }
  }
  async read(path) { const [bytes] = await this.bucket.file(path).download(); return bytes; }
  async markReady(path) { const file = this.bucket.file(path); const [metadata] = await file.getMetadata(); await file.setMetadata({ metadata: { ...(metadata.metadata ?? {}), publicationState: 'READY' } }); }
}

export class FirebaseAssetRegistry {
  constructor(db, bucket = null) { this.db = db; this.bucket = bucket; }
  async exists(assetId) {
    if (!/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(String(assetId ?? ''))) return false;
    return (await this.db.collection('adminContentAssets').doc(String(assetId)).get()).exists;
  }
  async list({ limit = 25, cursor = null } = {}) {
    let query = this.db.collection('adminContentAssets').orderBy(FieldPath.documentId()).limit(limit);
    if (cursor) {
      const previous = await this.db.collection('adminContentAssets').doc(cursor).get();
      if (!previous.exists) throw new ContentPublicationError('content/cursor-invalid', 'The page cursor is no longer available.', { status: 400 });
      query = query.startAfter(previous);
    }
    const page = await query.get();
    return { items: page.docs.map((doc) => doc.data()), nextCursor: page.docs.length === limit ? page.docs.at(-1).id : null };
  }
  async create(metadata, bytes, actor) {
    if (!this.bucket) throw new Error('Asset storage is not configured.');
    const file = this.bucket.file(metadata.path);
    await file.save(bytes, { resumable: false, contentType: metadata.mediaType, preconditionOpts: { ifGenerationMatch: 0 } });
    try {
      const batch = this.db.batch();
      batch.create(this.db.collection('adminContentAssets').doc(metadata.assetId), metadata);
      batch.create(this.db.collection('adminContentAudit').doc(), { event: 'ASSET_CREATED', actorUid: actor.uid, actorRole: actor.role, timestamp: metadata.createdAt, assetId: metadata.assetId, mediaType: metadata.mediaType, size: metadata.size });
      await batch.commit();
    } catch (error) { await file.delete().catch(() => undefined); throw error; }
    return metadata;
  }
  async get(assetId) {
    if (!/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(String(assetId ?? ''))) throw new ContentPublicationError('content/asset-invalid', 'Asset ID is invalid.', { status: 400 });
    const snapshot = await this.db.collection('adminContentAssets').doc(assetId).get();
    return snapshot.exists ? snapshot.data() : null;
  }
  async read(asset) { if (!this.bucket || !/^admin-content-assets\/asset-[a-f0-9-]{36}\.(png|jpg|webp)$/.test(asset?.path ?? '')) return null; return (await this.bucket.file(asset.path).download())[0]; }
}
