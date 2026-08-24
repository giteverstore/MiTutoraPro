function normalizeLanguageId(languageId) {
  return String(languageId ?? '').trim().toLowerCase();
}

function runtimeKey(languageId, instanceId = 'default') {
  return `${normalizeLanguageId(languageId)}::${String(instanceId || 'default')}`;
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

  resolve(languageId, instanceId = 'default') {
    const id = normalizeLanguageId(languageId);
    const factory = this.factories.get(id);
    if (!factory) throw new Error(`No compiler runtime is registered for "${languageId}".`);
    const key = runtimeKey(id, instanceId);
    if (!this.instances.has(key)) this.instances.set(key, factory());
    return this.instances.get(key);
  }

  release(languageId, instanceId = 'default') {
    const key = runtimeKey(languageId, instanceId);
    const runtime = this.instances.get(key);
    if (!runtime) return Promise.resolve();
    this.instances.delete(key);
    return runtime.dispose();
  }

  getInitializedRuntimes() {
    return [...this.instances.values()];
  }

  async dispose() {
    await Promise.all([...this.instances.values()].map((runtime) => runtime.dispose()));
    this.instances.clear();
  }
}
