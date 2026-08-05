export class ContentCache {
  #entries = new Map();

  has(storagePath) {
    return this.#entries.has(storagePath);
  }

  get(storagePath) {
    return this.#entries.get(storagePath);
  }

  set(storagePath, value) {
    this.#entries.set(storagePath, value);
    return value;
  }

  getOrCreate(storagePath, factory) {
    console.log('[TRACE] ContentCache.getOrCreate');
    if (this.has(storagePath)) return this.get(storagePath);
    const pending = Promise.resolve().then(factory);
    this.set(storagePath, pending);
    pending.catch(() => {
      if (this.get(storagePath) === pending) this.invalidate(storagePath);
    });
    return pending;
  }

  invalidate(storagePath) {
    return this.#entries.delete(storagePath);
  }

  clear() {
    this.#entries.clear();
  }
}

export const contentCache = new ContentCache();
