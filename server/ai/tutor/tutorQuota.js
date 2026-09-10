import { createHmac, randomUUID } from 'node:crypto';
import { AIServiceError } from '../AIServiceError.js';
import { FirestoreTutorQuotaStore, applyQuotaReservation, applyQuotaSettlement, assertMatchingQuotaReservation } from '../quota/FirestoreTutorQuotaStore.js';
import { createTutorQuotaFirestore } from '../quota/createTutorQuotaFirestore.js';
import { createTutorQuotaPolicy, isManagedTutorRuntime } from './tutorRuntimeConfig.js';

const DEFAULT_ESTIMATE = Object.freeze({ inputTokens: 0, outputTokens: 0, costMicros: null });

function normalizedEstimate(estimate = {}) {
  return Object.freeze({
    inputTokens: Math.max(0, Math.ceil(Number(estimate.inputTokens) || 0)),
    outputTokens: Math.max(0, Math.ceil(Number(estimate.outputTokens) || 0)),
    costMicros: estimate.costMicros == null ? null : Math.max(0, Math.ceil(Number(estimate.costMicros) || 0)),
  });
}

function quotaUnavailable(cause) {
  return new AIServiceError('ai/quota-unavailable', 'The AI Tutor is temporarily unavailable.', { status: 503, cause });
}

export class TutorQuotaStore {
  async reserve() {
    throw new Error('TutorQuotaStore.reserve() must be implemented.');
  }

  async settle() {}
}

export class ProcessLocalTutorQuotaStore extends TutorQuotaStore {
  constructor({ now = Date.now } = {}) {
    super();
    this.now = now;
    this.quotas = new Map();
    this.reservations = new Map();
  }

  async reserve({ identityKey, requestId, policy, estimate, maximum = estimate }) {
    if (this.reservations.has(requestId)) {
      return assertMatchingQuotaReservation(this.reservations.get(requestId), { identityKey, estimate, maximum });
    }
    const now = this.now();
    const next = applyQuotaReservation(this.quotas.get(identityKey), { now, policy, maximum });
    const reservation = Object.freeze({ requestId, identityKey, estimate, maximum, state: 'PENDING', createdAt: now });
    this.quotas.set(identityKey, next);
    this.reservations.set(requestId, reservation);
    return reservation;
  }

  async settle(reservation, usage = {}) {
    const stored = this.reservations.get(reservation?.requestId);
    if (!stored || stored.state !== 'PENDING') return;
    const now = this.now();
    const current = this.quotas.get(stored.identityKey);
    this.quotas.set(stored.identityKey, applyQuotaSettlement(current, stored, { ...usage, now }));
    this.reservations.set(stored.requestId, Object.freeze({ ...stored, state: 'SETTLED', outcome: String(usage.outcome || 'unknown'), settledAt: now }));
  }

  snapshot(identityKey) {
    return this.quotas.get(identityKey) ?? null;
  }
}

export class LazyFirestoreTutorQuotaStore extends TutorQuotaStore {
  constructor(environment, { createFirestore = createTutorQuotaFirestore } = {}) {
    super();
    this.environment = environment;
    this.createFirestore = createFirestore;
    this.storePromise = null;
  }

  async getStore() {
    if (!this.storePromise) {
      this.storePromise = Promise.resolve()
        .then(() => this.createFirestore(this.environment))
        .then((db) => new FirestoreTutorQuotaStore({ db }));
    }
    return this.storePromise;
  }

  async reserve(input) {
    return (await this.getStore()).reserve(input);
  }

  async settle(reservation, usage) {
    return (await this.getStore()).settle(reservation, usage);
  }
}

export class TutorQuotaGuard {
  constructor({ distributedStore = null, localStore = new ProcessLocalTutorQuotaStore(), allowProcessLocal = false, policy, identitySalt = 'local-development' } = {}) {
    this.distributedStore = distributedStore;
    this.localStore = localStore;
    this.allowProcessLocal = allowProcessLocal;
    this.policy = policy ?? createTutorQuotaPolicy({});
    this.identitySalt = String(identitySalt || '');
  }

  identityKey(uid) {
    if (!this.identitySalt) throw quotaUnavailable();
    return createHmac('sha256', this.identitySalt).update(uid).digest('hex');
  }

  async assertAllowed({ uid, requestId = randomUUID(), usageEstimate = DEFAULT_ESTIMATE, usageMaximum = usageEstimate } = {}) {
    if (typeof uid !== 'string' || !uid) {
      throw new AIServiceError('ai/auth-required', 'Sign in to use the AI Tutor.', { status: 401 });
    }
    const store = this.distributedStore ?? (this.allowProcessLocal ? this.localStore : null);
    if (!store) throw quotaUnavailable();
    const input = {
      uid,
      identityKey: this.identityKey(uid),
      requestId,
      policy: this.policy,
      estimate: normalizedEstimate(usageEstimate),
      maximum: normalizedEstimate(usageMaximum),
    };
    try {
      if (typeof store.reserve === 'function') return await store.reserve(input);
      if (typeof store.consume === 'function') {
        await store.consume({ uid, trustedNetworkKey: '' });
        return Object.freeze({ requestId, identityKey: input.identityKey, estimate: input.estimate, legacy: true });
      }
      throw new TypeError('Quota store does not implement reserve().');
    } catch (error) {
      if (error instanceof AIServiceError) throw error;
      throw quotaUnavailable(error);
    }
  }

  async settle(reservation, usage = {}) {
    if (!reservation || reservation.legacy) return true;
    const store = this.distributedStore ?? (this.allowProcessLocal ? this.localStore : null);
    if (!store?.settle) return false;
    try {
      await store.settle(reservation, usage);
      return true;
    } catch {
      // Settlement errors are reported through sanitized operational telemetry.
      // They must never weaken request/response safety boundaries.
      return false;
    }
  }
}

export function createDefaultTutorQuotaGuard(environment = process.env, options = {}) {
  try {
    const production = isManagedTutorRuntime(environment);
    const backend = String(environment.AI_TUTOR_QUOTA_BACKEND ?? '').trim().toLowerCase();
    const distributedStore = options.distributedStore
      ?? (backend === 'firestore'
        ? new LazyFirestoreTutorQuotaStore(environment, { createFirestore: options.createFirestore })
        : null);
    const explicitlyAllowed = environment.AI_ALLOW_PROCESS_LOCAL_QUOTA === 'true';
    return new TutorQuotaGuard({
      distributedStore,
      localStore: options.localStore,
      allowProcessLocal: options.allowProcessLocal ?? (!production && explicitlyAllowed),
      policy: options.policy ?? createTutorQuotaPolicy(environment),
      identitySalt: environment.AI_TUTOR_QUOTA_IDENTITY_SALT || (!production ? 'local-development' : ''),
    });
  } catch (configurationError) {
    return Object.freeze({
      async assertAllowed() { throw quotaUnavailable(configurationError); },
      async settle() {},
    });
  }
}

export const tutorQuotaGuard = createDefaultTutorQuotaGuard();
