import { randomUUID } from 'node:crypto';
import { createDefaultFirestore } from '../firestore/createDefaultFirestore.js';
import { RemoteCompilerError } from './RemoteCompilerError.js';

const DEFAULTS = Object.freeze({ windowMs: 60_000, maxRequests: 20, leaseMs: 30_000, maxUserActive: 1, maxGlobalActive: 4 });
const activeLeases = (value, now) => Object.fromEntries(Object.entries(value ?? {}).filter(([, lease]) => Number(lease?.expiresAt) > now));

export class RemoteCompilerQuota {
  constructor({ db, now = Date.now, policy = DEFAULTS } = {}) {
    if (!db?.runTransaction || !db?.doc) throw new TypeError('Remote compiler quota requires Firestore transactions.');
    this.db = db; this.now = now; this.policy = Object.freeze({ ...DEFAULTS, ...policy });
  }
  async acquire(uid) {
    const now = this.now(); const leaseId = randomUUID();
    const userRef = this.db.doc(`remoteCompilerQuotas/${uid}`); const globalRef = this.db.doc('remoteCompilerRuntime/global');
    await this.db.runTransaction(async (transaction) => {
      const [userSnapshot, globalSnapshot] = await Promise.all([transaction.get(userRef), transaction.get(globalRef)]);
      const user = userSnapshot.exists ? userSnapshot.data() : {}; const global = globalSnapshot.exists ? globalSnapshot.data() : {};
      const windowStartedAt = Number(user.windowStartedAt); const inWindow = Number.isFinite(windowStartedAt) && now - windowStartedAt < this.policy.windowMs;
      const requests = inWindow ? Number(user.requests) || 0 : 0; const userLeases = activeLeases(user.leases, now); const globalLeases = activeLeases(global.leases, now);
      if (requests >= this.policy.maxRequests) throw new RemoteCompilerError('remote-compiler/rate-limited', 'Too many compiler executions. Try again shortly.', { status: 429 });
      if (Object.keys(userLeases).length >= this.policy.maxUserActive || Object.keys(globalLeases).length >= this.policy.maxGlobalActive) throw new RemoteCompilerError('remote-compiler/busy', 'The compiler service is busy. Try again shortly.', { status: 429 });
      const lease = { owner: uid, createdAt: now, expiresAt: now + this.policy.leaseMs };
      transaction.set(userRef, { windowStartedAt: inWindow ? windowStartedAt : now, requests: requests + 1, leases: { ...userLeases, [leaseId]: lease }, updatedAt: now }, { merge: false });
      transaction.set(globalRef, { leases: { ...globalLeases, [leaseId]: lease }, updatedAt: now }, { merge: false });
    });
    return Object.freeze({ uid, leaseId });
  }
  async release({ uid, leaseId } = {}) {
    if (!uid || !leaseId) return; const now = this.now();
    const userRef = this.db.doc(`remoteCompilerQuotas/${uid}`); const globalRef = this.db.doc('remoteCompilerRuntime/global');
    await this.db.runTransaction(async (transaction) => {
      const [userSnapshot, globalSnapshot] = await Promise.all([transaction.get(userRef), transaction.get(globalRef)]);
      const user = userSnapshot.exists ? userSnapshot.data() : {}; const global = globalSnapshot.exists ? globalSnapshot.data() : {};
      const userLeases = activeLeases(user.leases, now); const globalLeases = activeLeases(global.leases, now); delete userLeases[leaseId]; delete globalLeases[leaseId];
      transaction.set(userRef, { ...user, leases: userLeases, updatedAt: now }, { merge: false }); transaction.set(globalRef, { ...global, leases: globalLeases, updatedAt: now }, { merge: false });
    });
  }
}

export async function createRemoteCompilerQuota(environment, credentials) {
  if (environment.REMOTE_COMPILER_DISTRIBUTED_QUOTA_ENABLED !== 'true') throw new RemoteCompilerError('remote-compiler/unavailable', 'Distributed compiler controls are not configured.', { status: 503 });
  const session = await createDefaultFirestore(environment, credentials);
  return Object.freeze({ quota: new RemoteCompilerQuota({ db: session.db }), close: session.close });
}
