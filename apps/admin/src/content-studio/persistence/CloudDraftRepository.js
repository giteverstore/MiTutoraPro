import { auth } from '../../../../../src/firebase/auth.js';
import { DraftRepository } from './DraftRepository.js';

export class CloudDraftConflictError extends Error {
  constructor(details) { super('This draft was updated elsewhere. Reload the latest version before saving.'); this.name = 'CloudDraftConflictError'; this.code = 'content/draft-conflict'; this.details = details; }
}

async function request(path, { method = 'GET', body } = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Admin authentication is required.');
  const response = await fetch(`/api/admin-content/${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (payload.error?.code === 'content/draft-conflict') throw new CloudDraftConflictError(payload.error.details);
    const error = new Error(payload.error?.message ?? 'Content request failed.'); error.code = payload.error?.code; throw error;
  }
  return payload;
}

export class CloudDraftRepository extends DraftRepository {
  constructor(contentType = null) { super(); this.contentType = contentType; }
  static editorDraft(record) { return record ? { ...record.document, documentId: record.contentId, draftRevision: record.draftRevision, lifecycleState: record.lifecycleState, validationSummary: record.validationSummary } : null; }
  editorDraft(record) {
    if (this.contentType && record && (record.contentType !== this.contentType || record.document?.contentType !== this.contentType)) throw new Error('Draft content type does not match this editor.');
    return CloudDraftRepository.editorDraft(record);
  }
  async load(contentId) { return this.editorDraft((await request(`drafts/${encodeURIComponent(contentId)}`)).draft); }
  async list() { return (await request('drafts')).drafts.filter((draft) => !this.contentType || draft.contentType === this.contentType).map((draft) => ({ ...this.editorDraft(draft), updatedAt: draft.updatedAt, updatedBy: draft.updatedBy })); }
  async save(document, expectedRevision = document.draftRevision ?? 0) {
    const { documentId, draftRevision, lifecycleState, validationSummary, ...canonical } = document;
    if (canonical.contentType !== this.contentType) throw new Error('Draft content type does not match this editor.');
    return this.editorDraft((await request('drafts', { method: 'POST', body: { contentType: this.contentType, document: canonical, expectedRevision } })).draft);
  }
  async validate(contentId, expectedRevision) { return (await request('validate', { method: 'POST', body: { contentType: this.contentType, contentId, expectedRevision } })).validation; }
  async publish(contentId, expectedRevision, expectedActiveRevision = null) { return request('publish', { method: 'POST', body: { contentType: this.contentType, contentId, expectedRevision, expectedActiveRevision } }); }
  async history(contentId) { return request(`history/${encodeURIComponent(contentId)}`); }
  async rollback(contentId, version, expectedActiveRevision) { return request('rollback', { method: 'POST', body: { contentType: this.contentType, contentId, version, expectedActiveRevision } }); }
  async archive(contentId, expectedActiveRevision) { return request('archive', { method: 'POST', body: { contentType: this.contentType, contentId, expectedActiveRevision } }); }
}
