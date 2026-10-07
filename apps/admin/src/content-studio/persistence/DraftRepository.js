export class DraftRepository {
  async load() { throw new Error('DraftRepository.load must be implemented.'); }
  async save() { throw new Error('DraftRepository.save must be implemented.'); }
  async list() { return []; }
}

export class LocalDraftRepository extends DraftRepository {
  constructor(storage = globalThis.localStorage, namespace = 'ycoders.admin.content-draft.v1') { super(); this.storage = storage; this.namespace = namespace; }
  key(documentId) { return `${this.namespace}:${documentId}`; }
  get activeKey() { return `${this.namespace}:active-document`; }
  async load(documentId) {
    const direct = this.storage?.getItem(this.key(documentId));
    const activeDocumentId = this.storage?.getItem(this.activeKey);
    const value = direct ?? (activeDocumentId ? this.storage?.getItem(this.key(activeDocumentId)) : null);
    return value ? JSON.parse(value) : null;
  }
  async save(document) {
    this.storage?.setItem(this.key(document.documentId), JSON.stringify(document));
    this.storage?.setItem(this.activeKey, document.documentId);
    return { savedAt: new Date().toISOString() };
  }
  async list() {
    if (!this.storage) return [];
    const drafts = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (!key?.startsWith(`${this.namespace}:`) || key === this.activeKey) continue;
      try { drafts.push(JSON.parse(this.storage.getItem(key))); } catch { /* Ignore corrupt local entries. */ }
    }
    return drafts;
  }
}
