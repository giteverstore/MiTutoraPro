function normalizeLanguageId(languageId) {
  return String(languageId ?? '').trim().toLowerCase();
}

export class RuntimeRegistry {
  constructor() {
    this.factories = new Map();
    this.instances = new Map();
  }

  register(languageId, runtimeFactory) {
    const id = normalizeLanguageId(languageId);
    if (!id) throw new Error('RuntimeRegistry requires a language ID.');
    if (typeof runtimeFactory !== 'function') {
      throw new Error(`Runtime factory for "${id}" must be a function.`);
    }
    this.factories.set(id, runtimeFactory);
    return this;
  }

  has(languageId) {
    return this.factories.has(normalizeLanguageId(languageId));
  }

  resolve(languageId) {
    const id = normalizeLanguageId(languageId);
    const factory = this.factories.get(id);
    if (!factory) throw new Error(`No compiler runtime is registered for "${languageId}".`);
    if (!this.instances.has(id)) this.instances.set(id, factory());
    return this.instances.get(id);
  }

  getInitializedRuntimes() {
    return [...this.instances.values()];
  }

  async dispose() {
    await Promise.all([...this.instances.values()].map((runtime) => runtime.dispose()));
    this.instances.clear();
  }
}
