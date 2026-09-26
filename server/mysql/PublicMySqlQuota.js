import { createHash, randomUUID } from 'node:crypto';
import { createDefaultFirestore } from '../firestore/createDefaultFirestore.js';
import { MySqlExecutionError } from './MySqlExecutionError.js';

export const PUBLIC_MYSQL_QUOTA_POLICY = Object.freeze({
  shortWindowMs: 10 * 60_000,
  anonymousShortMax: 10,
  authenticatedShortMax: 20,
  longWindowMs: 60 * 60_000,
  anonymousLongMax: 30,
  authenticatedLongMax: 60,
  maxIdentityActive: 1,
  maxGlobalActive: 4,
  leaseMs: 75_000,
});

const activeLeases = (value, now) => Object.fromEntries(Object.entries(value ?? {}).filter(([, lease]) => Number(lease?.expiresAt) > now));
export const publicMySqlIdentityHash = (kind, value) => createHash('sha256').update(`${kind}:${value}`).digest('hex').slice(0, 40);

export class PublicMySqlQuota {
  constructor({ db, now = Date.now, policy = PUBLIC_MYSQL_QUOTA_POLICY } = {}) {
    if (!db?.runTransaction || !db?.doc) throw new TypeError('Public MySQL quota requires Firestore transactions.');
    this.db = db;
    this.now = now;
    this.policy = Object.freeze({ ...PUBLIC_MYSQL_QUOTA_POLICY, ...policy });
  }

  async acquire({ identity, authenticated }) {
    const now = this.now();
    const executionId = randomUUID();
    const identityHash = publicMySqlIdentityHash(authenticated ? 'uid' : 'address', identity);
    const identityRef = this.db.doc(`compilerPublicMysqlRateLimits/${identityHash}`);
    const runtimeRef = this.db.doc('compilerPublicMysqlRuntime/global');
    await this.db.runTransaction(async (transaction) => {
      const [identitySnapshot, runtimeSnapshot] = await Promise.all([transaction.get(identityRef), transaction.get(runtimeRef)]);
      const state = identitySnapshot.exists ? identitySnapshot.data() : {};
      const runtime = runtimeSnapshot.exists ? runtimeSnapshot.data() : {};
      const shortActive = Number.isFinite(Number(state.shortWindowStartedAt)) && now - Number(state.shortWindowStartedAt) < this.policy.shortWindowMs;
      const longActive = Number.isFinite(Number(state.longWindowStartedAt)) && now - Number(state.longWindowStartedAt) < this.policy.longWindowMs;
      const shortCount = shortActive ? Number(state.shortCount) || 0 : 0;
      const longCount = longActive ? Number(state.longCount) || 0 : 0;
      const identityLeases = activeLeases(state.leases, now);
      const globalLeases = activeLeases(runtime.leases, now);
      const shortMax = authenticated ? this.policy.authenticatedShortMax : this.policy.anonymousShortMax;
      const longMax = authenticated ? this.policy.authenticatedLongMax : this.policy.anonymousLongMax;
      if (shortCount >= shortMax || longCount >= longMax) throw new MySqlExecutionError('compiler/mysql-public-rate-limit', 'Too many MySQL executions. Please try again later.', { status: 429 });
      if (Object.keys(identityLeases).length >= this.policy.maxIdentityActive) throw new MySqlExecutionError('compiler/mysql-public-concurrency', 'Only one MySQL execution can run at a time.', { status: 429 });
      if (Object.keys(globalLeases).length >= this.policy.maxGlobalActive) throw new MySqlExecutionError('compiler/mysql-busy', 'The MySQL compiler is busy right now. Please try again shortly.', { status: 503 });
      const lease = { executionId, identityHash, createdAt: now, expiresAt: now + this.policy.leaseMs, mode: 'public', service: 'mysql' };
      transaction.set(identityRef, { authenticated, shortWindowStartedAt: shortActive ? Number(state.shortWindowStartedAt) : now, shortCount: shortCount + 1, longWindowStartedAt: longActive ? Number(state.longWindowStartedAt) : now, longCount: longCount + 1, leases: { ...identityLeases, [executionId]: lease }, expiresAt: now + this.policy.longWindowMs + this.policy.leaseMs, updatedAt: now }, { merge: false });
      transaction.set(runtimeRef, { leases: { ...globalLeases, [executionId]: lease }, updatedAt: now }, { merge: false });
    });
    return Object.freeze({ identityHash, executionId });
  }

  async release({ identityHash, executionId } = {}) {
    if (!identityHash || !executionId) return;
    const now = this.now();
    const identityRef = this.db.doc(`compilerPublicMysqlRateLimits/${identityHash}`);
    const runtimeRef = this.db.doc('compilerPublicMysqlRuntime/global');
    await this.db.runTransaction(async (transaction) => {
      const [identitySnapshot, runtimeSnapshot] = await Promise.all([transaction.get(identityRef), transaction.get(runtimeRef)]);
      const state = identitySnapshot.exists ? identitySnapshot.data() : {};
      const runtime = runtimeSnapshot.exists ? runtimeSnapshot.data() : {};
      const identityLeases = activeLeases(state.leases, now);
      const globalLeases = activeLeases(runtime.leases, now);
      delete identityLeases[executionId]; delete globalLeases[executionId];
      transaction.set(identityRef, { ...state, leases: identityLeases, updatedAt: now }, { merge: false });
      transaction.set(runtimeRef, { ...runtime, leases: globalLeases, updatedAt: now }, { merge: false });
    });
  }
}

export async function createPublicMySqlQuota(environment, credentials) {
  if (environment.MYSQL_DISTRIBUTED_QUOTA_ENABLED !== 'true') throw new MySqlExecutionError('compiler/mysql-unavailable', 'The MySQL compiler is temporarily unavailable.', { status: 503 });
  const session = await createDefaultFirestore(environment, credentials);
  return Object.freeze({ quota: new PublicMySqlQuota({ db: session.db }), close: session.close });
}

export async function cleanupExpiredPublicMySqlQuotas(db, now = Date.now(), limit = 200) {
  const snapshot = await db.collection('compilerPublicMysqlRateLimits').where('expiresAt', '<=', now).limit(limit).get();
  if (snapshot.empty) return { deleted: 0 };
  const batch = db.batch(); snapshot.docs.forEach((document) => batch.delete(document.ref)); await batch.commit();
  return { deleted: snapshot.size };
}
