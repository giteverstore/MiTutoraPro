export class ContentCache {
  #entries = new Map();

  constructor({ maxEntries = 100 } = {}) {
    this.maxEntries = maxEntries;
  }

  has(storagePath) {
    return this.#entries.has(storagePath);
  }

  get(storagePath) {
    const value = this.#entries.get(storagePath);
    if (value !== undefined) {
      this.#entries.delete(storagePath);
      this.#entries.set(storagePath, value);
    }
    return value;
  }

  set(storagePath, value) {
    if (this.#entries.has(storagePath)) this.#entries.delete(storagePath);
    this.#entries.set(storagePath, value);
    while (this.#entries.size > this.maxEntries) this.#entries.delete(this.#entries.keys().next().value);
    return value;
  }

  getOrCreate(storagePath, factory) {
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

  invalidateMatching(predicate) {
    let removed = 0;
    for (const key of this.#entries.keys()) {
      if (predicate(key)) {
        this.#entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clear() {
    this.#entries.clear();
  }
}

export const contentCache = new ContentCache();
