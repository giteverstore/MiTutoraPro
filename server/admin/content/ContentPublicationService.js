import { createHash, randomUUID } from 'node:crypto';
import {
  DRAFT_LIFECYCLE,
  MAX_ARTIFACT_BYTES,
  MAX_DRAFT_BYTES,
  PUBLICATION_STATUS,
  assertContentSize,
  normalizeContent,
  safeContentId,
  validateContent,
} from '../../../shared/content/index.js';
import { ContentPublicationError } from './ContentPublicationError.js';

const now = (clock) => clock().toISOString();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const audit = (event, actor, values = {}) => ({ eventId: randomUUID(), event, actorUid: actor.uid, actorRole: actor.role, timestamp: values.timestamp, ...values });

function validationFailure(result) {
  throw new ContentPublicationError('content/validation-failed', 'Content validation failed.', { status: 422, details: result.errors });
}

export class ContentPublicationService {
  constructor({ store, artifacts, assets = { exists: async () => true }, clock = () => new Date() }) {
    this.store = store;
    this.artifacts = artifacts;
    this.assets = assets;
    this.clock = clock;
  }

  async saveDraft({ actor, document, expectedRevision = 0 }) {
    const contentId = safeContentId(document?.contentId ?? document?.documentId);
    if (document?.contentType === 'COURSE') {
      assertContentSize(document, MAX_ARTIFACT_BYTES, 'Course draft');
      for (const module of document.content?.modules ?? []) assertContentSize(module, MAX_DRAFT_BYTES, `Course module ${module.id ?? ''}`.trim());
    } else assertContentSize(document, MAX_DRAFT_BYTES, 'Draft');
    const current = await this.store.getDraft(contentId);
    if (current && current.contentType !== document.contentType) {
      throw new ContentPublicationError('content/type-conflict', 'An existing draft cannot change content type.', { status: 409 });
    }
    if ((current?.draftRevision ?? 0) !== expectedRevision) {
      throw new ContentPublicationError('content/draft-conflict', 'This draft was updated elsewhere. Reload the latest version before saving.', { status: 409, details: { currentRevision: current?.draftRevision ?? 0 } });
    }
    const timestamp = now(this.clock);
    const draft = {
      contentId, contentType: document.contentType, schemaVersion: document.schemaVersion,
      draftRevision: expectedRevision + 1, createdAt: current?.createdAt ?? timestamp,
      createdBy: current?.createdBy ?? actor.uid, updatedAt: timestamp, updatedBy: actor.uid,
      document: { ...document, contentId }, validationSummary: null, lifecycleState: DRAFT_LIFECYCLE.DRAFT,
    };
    await this.store.createOrUpdateDraft(draft, expectedRevision);
    await this.store.appendAudit(audit(current ? 'DRAFT_UPDATED' : 'DRAFT_CREATED', actor, { timestamp, contentId, contentType: draft.contentType, draftRevision: draft.draftRevision }));
    return draft;
  }

  async validateDraft({ actor, contentId, expectedRevision }) {
    const draft = await this.requireDraft(contentId, expectedRevision);
    const result = validateContent(draft.document);
    const timestamp = now(this.clock);
    await this.store.updateDraftValidation(draft.contentId, draft.draftRevision, {
      validationSummary: { valid: result.valid, errors: result.errors, warnings: result.warnings, validatedAt: timestamp, validatedBy: actor.uid },
      lifecycleState: result.valid ? DRAFT_LIFECYCLE.VALIDATED : DRAFT_LIFECYCLE.DRAFT,
    });
    return result;
  }

  async deleteDraft({ actor, contentId, contentType, expectedRevision }) {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) throw new ContentPublicationError('content/revision-invalid', 'A valid draft revision is required.', { status: 400 });
    const draft = await this.requireDraft(contentId, expectedRevision);
    if (draft.contentType !== contentType) throw new ContentPublicationError('content/type-conflict', 'Content type does not match this request.', { status: 409 });
    if (draft.lifecycleState === DRAFT_LIFECYCLE.PUBLISHING) throw new ContentPublicationError('content/draft-publishing', 'A draft cannot be deleted while publication is in progress.', { status: 409 });
    await this.store.deleteDraft({ contentId: draft.contentId, contentType, expectedRevision, actor, timestamp: now(this.clock) });
    return { contentId: draft.contentId, deleted: true };
  }

  async publish({ actor, contentId, expectedRevision, expectedActiveRevision = null }) {
    const draft = await this.requireDraft(contentId, expectedRevision);
    const canonical = normalizeContent(draft.document);
    const validation = validateContent(canonical);
    if (!validation.valid) validationFailure(validation);
    await this.verifyAssets(canonical);
    const timestamp = now(this.clock);
    const allocation = await this.store.allocateVersion({ draft, actor, timestamp, expectedActiveRevision });
    const version = allocation.version;
    try {
      const artifactPath = `published-content/${canonical.contentType.toLowerCase()}s/${safeContentId(contentId)}/v${version}.json`;
      const published = { ...canonical, version, status: 'published', metadata: { ...canonical.metadata, publishedAt: timestamp, publishedBy: actor.uid } };
      const bytes = Buffer.from(JSON.stringify(published));
      assertContentSize(published, MAX_ARTIFACT_BYTES, 'Published artifact');
      const artifactHash = hash(bytes);
      await this.artifacts.createImmutable(artifactPath, bytes, { artifactHash, contentId, version: String(version) });
      const stored = await this.artifacts.read(artifactPath);
      if (hash(stored) !== artifactHash) throw new Error('Artifact integrity verification failed.');
      await this.artifacts.markReady?.(artifactPath);
      const metadata = {
        contentId, contentType: canonical.contentType, version, schemaVersion: canonical.schemaVersion,
        status: PUBLICATION_STATUS.READY, artifactPath, artifactHash, artifactSize: bytes.byteLength,
        ...(this.artifacts.bucketName ? { artifactBucket: this.artifacts.bucketName } : {}),
        publishedAt: timestamp, publishedBy: actor.uid, sourceDraftRevision: draft.draftRevision,
        locale: canonical.locale, metadataSnapshot: {
          title: canonical.content?.title ?? '', summary: canonical.content?.summary ?? canonical.content?.description ?? '',
          language: canonical.content?.language ?? '', difficulty: canonical.content?.difficulty ?? '',
          topic: canonical.content?.topic ?? (canonical.contentType === 'COURSE' ? canonical.content?.tags?.[0] : '') ?? '', category: canonical.content?.category ?? '',
          estimatedMinutes: canonical.content?.estimatedMinutes ?? 0, xp: canonical.content?.xp ?? 0,
          lessonCount: canonical.contentType === 'COURSE' ? canonical.content.modules.flatMap((module) => module.sections?.flatMap((section) => section.lessons) ?? module.lessons ?? []).length : 0,
          moduleCount: canonical.contentType === 'COURSE' ? canonical.content.modules.length : 0,
        },
      };
      const active = await this.store.completePublication({ metadata, actor, timestamp, expectedActiveRevision: allocation.activeRevision });
      return { version: metadata, active };
    } catch (cause) {
      await this.store.failPublication({
        contentId, version, sourceDraftRevision: draft.draftRevision,
        expectedActiveRevision: allocation.activeRevision, timestamp,
      }).catch(() => undefined);
      throw new ContentPublicationError('content/publication-failed', 'Publication could not be completed. The previous ACTIVE version is unchanged.', { status: 503, cause });
    }
  }

  async activate({ actor, contentId, version, expectedActiveRevision }) {
    const timestamp = now(this.clock);
    return this.store.activateVersion({ contentId: safeContentId(contentId), version: Number(version), actor, timestamp, expectedActiveRevision, auditEvent: 'CONTENT_ROLLED_BACK' });
  }

  async archive({ actor, contentId, expectedActiveRevision }) {
    const timestamp = now(this.clock);
    return this.store.archiveContent({ contentId: safeContentId(contentId), actor, timestamp, expectedActiveRevision });
  }

  history(contentId) { return this.store.listVersions(safeContentId(contentId)); }
  pointer(contentId) { return this.store.getPointer(safeContentId(contentId)); }
  getDraft(contentId) { return this.store.getDraft(safeContentId(contentId)); }
  listDrafts() { return this.store.listDrafts(); }
  listDraftSummaries(options) { return this.store.listDraftSummaries(options); }
  listPointers(options) { return this.store.listPointers(options); }

  async requireDraft(contentId, expectedRevision) {
    const draft = await this.store.getDraft(safeContentId(contentId));
    if (!draft) throw new ContentPublicationError('content/draft-not-found', 'Draft not found.', { status: 404 });
    if (expectedRevision != null && draft.draftRevision !== expectedRevision) {
      throw new ContentPublicationError('content/draft-conflict', 'This draft was updated elsewhere. Reload the latest version before continuing.', { status: 409, details: { currentRevision: draft.draftRevision } });
    }
    return draft;
  }

  async verifyAssets(document) {
    const references = [];
    const canonicalCourseImages = [];
    const visit = (value) => {
      if (!value || typeof value !== 'object') return;
      if (value.type === 'image' && value.assetId) references.push(value.assetId);
      if (document.contentType === 'COURSE' && value.type === 'image' && !value.src) canonicalCourseImages.push(value.assetId);
      Object.values(value).forEach(visit);
    };
    visit(document.content);
    for (const assetId of new Set(references)) {
      if (!await this.assets.exists(assetId)) throw new ContentPublicationError('content/asset-missing', `Referenced asset "${assetId}" does not exist.`, { status: 422 });
    }
    for (const assetId of new Set(canonicalCourseImages)) {
      if (!/^asset-[a-f0-9-]{36}$/.test(assetId ?? '') || !await this.assets.verifyReadable?.(assetId)) {
        throw new ContentPublicationError('content/asset-missing', 'A Course image is not available in Admin asset storage.', { status: 422 });
      }
    }
  }
}
