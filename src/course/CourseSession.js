const DEFAULT_CACHE_WINDOW = 3;

function assertModuleNumber(moduleNumber, moduleCount) {
  if (!Number.isInteger(moduleNumber) || moduleNumber < 1 || moduleNumber > moduleCount) {
    throw new RangeError(`Module number must be between 1 and ${moduleCount}.`);
  }
}

function createModuleSummary(module) {
  return Object.freeze({
    ...module,
    lessons: Object.freeze(module.lessons.map((lesson) => Object.freeze({
      ...lesson,
      blocks: Object.freeze([]),
      contentLoaded: false,
    }))),
    contentLoaded: false,
  });
}

export class CourseSession {
  constructor({
    moduleCount,
    cacheWindow = DEFAULT_CACHE_WINDOW,
    loadModule,
    evictModule = () => undefined,
    onError = () => undefined,
  }) {
    if (!Number.isInteger(moduleCount) || moduleCount < 0) {
      throw new TypeError('CourseSession requires a non-negative module count.');
    }
    if (!Number.isInteger(cacheWindow) || cacheWindow < 3) {
      throw new RangeError('CourseSession cache window must retain at least three modules.');
    }
    if (typeof loadModule !== 'function') {
      throw new TypeError('CourseSession requires a module loader.');
    }
    this.moduleCount = moduleCount;
    this.cacheWindow = cacheWindow;
    this.loadModule = loadModule;
    this.evictModule = evictModule;
    this.onError = onError;
    this.activeModuleNumber = null;
    this.loadedModules = new Map();
    this.moduleCatalog = new Map();
    this.inFlight = new Map();
    this.prefetchQueue = [];
    this.prefetchingModuleNumber = null;
    this.listeners = new Set();
    this.accessOrder = new Map();
    this.accessSequence = 0;
    this.disposed = false;
  }

  prime(moduleNumber, module) {
    if (!moduleNumber || !module) return;
    assertModuleNumber(moduleNumber, this.moduleCount);
    this.loadedModules.set(moduleNumber, module);
    this.moduleCatalog.set(moduleNumber, module);
    this.activeModuleNumber = moduleNumber;
    this.touch(moduleNumber);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    if (this.disposed) return;
    for (const listener of this.listeners) listener(this.getSnapshot());
  }

  touch(moduleNumber) {
    this.accessSequence += 1;
    this.accessOrder.set(moduleNumber, this.accessSequence);
  }

  hasModule(moduleNumber) {
    return this.loadedModules.has(moduleNumber);
  }

  getModule(moduleNumber) {
    const module = this.loadedModules.get(moduleNumber) ?? null;
    if (module) this.touch(moduleNumber);
    return module;
  }

  getSnapshot() {
    const moduleEntries = [...this.moduleCatalog.entries()].sort(([left], [right]) => left - right);
    return Object.freeze({
      activeModuleNumber: this.activeModuleNumber,
      cacheWindow: this.cacheWindow,
      loadedModuleNumbers: Object.freeze([...this.loadedModules.keys()].sort((a, b) => a - b)),
      knownModuleNumbers: Object.freeze(moduleEntries.map(([moduleNumber]) => moduleNumber)),
      modules: Object.freeze(moduleEntries.map(([, module]) => module)),
      prefetchQueue: Object.freeze([...this.prefetchQueue]),
      isPrefetching: this.prefetchingModuleNumber !== null,
    });
  }

  ensureModule(moduleNumber, { retain = false } = {}) {
    assertModuleNumber(moduleNumber, this.moduleCount);
    const cached = this.getModule(moduleNumber);
    if (cached) return Promise.resolve(cached);
    if (this.inFlight.has(moduleNumber)) return this.inFlight.get(moduleNumber);

    const pending = Promise.resolve()
      .then(() => this.loadModule(moduleNumber))
      .then((module) => {
        if (this.disposed) return module;
        this.loadedModules.set(moduleNumber, module);
        this.moduleCatalog.set(moduleNumber, module);
        this.touch(moduleNumber);
        this.enforceCacheWindow(retain ? [moduleNumber] : []);
        this.emit();
        return module;
      })
      .finally(() => this.inFlight.delete(moduleNumber));
    this.inFlight.set(moduleNumber, pending);
    return pending;
  }

  activate(moduleNumber) {
    assertModuleNumber(moduleNumber, this.moduleCount);
    const activateLoadedModule = (module) => {
      if (this.disposed) return module;
      this.activeModuleNumber = moduleNumber;
      this.touch(moduleNumber);
      this.enforceCacheWindow();
      this.emit();
      this.prefetchNext();
      return module;
    };
    const cached = this.getModule(moduleNumber);
    return cached
      ? Promise.resolve(activateLoadedModule(cached))
      : this.ensureModule(moduleNumber, { retain: true }).then(activateLoadedModule);
  }

  prefetchNext() {
    if (this.disposed || this.activeModuleNumber === null) return;
    const nextModuleNumber = this.activeModuleNumber + 1;
    this.prefetchQueue = nextModuleNumber <= this.moduleCount
      && !this.loadedModules.has(nextModuleNumber)
      && !this.inFlight.has(nextModuleNumber)
      ? [nextModuleNumber]
      : [];
    this.emit();
    this.drainPrefetchQueue();
  }

  async drainPrefetchQueue() {
    if (this.prefetchingModuleNumber !== null || this.disposed) return;
    const moduleNumber = this.prefetchQueue.shift();
    if (!moduleNumber) return;
    this.prefetchingModuleNumber = moduleNumber;
    this.emit();
    try {
      await this.ensureModule(moduleNumber);
    } catch (error) {
      if (!this.disposed) this.onError(error, moduleNumber);
    } finally {
      this.prefetchingModuleNumber = null;
      this.emit();
      if (this.prefetchQueue.length) this.drainPrefetchQueue();
    }
  }

  enforceCacheWindow(additionalProtectedModules = []) {
    const protectedModules = new Set([
      this.activeModuleNumber - 1,
      this.activeModuleNumber,
      this.activeModuleNumber + 1,
      ...additionalProtectedModules,
    ]);
    while (this.loadedModules.size > this.cacheWindow) {
      const candidates = [...this.loadedModules.keys()]
        .filter((moduleNumber) => !protectedModules.has(moduleNumber))
        .sort((left, right) => {
          const distance = Math.abs(right - this.activeModuleNumber)
            - Math.abs(left - this.activeModuleNumber);
          return distance || (this.accessOrder.get(left) ?? 0) - (this.accessOrder.get(right) ?? 0);
        });
      const moduleNumber = candidates[0];
      if (moduleNumber === undefined) return;
      const module = this.loadedModules.get(moduleNumber);
      this.loadedModules.delete(moduleNumber);
      this.moduleCatalog.set(moduleNumber, createModuleSummary(module));
      this.accessOrder.delete(moduleNumber);
      this.evictModule(moduleNumber);
    }
  }

  dispose() {
    this.disposed = true;
    this.prefetchQueue = [];
    this.listeners.clear();
  }
}

export const COURSE_SESSION_DEFAULT_CACHE_WINDOW = DEFAULT_CACHE_WINDOW;
