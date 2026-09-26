import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MySqlDistributedQuota } from '../../server/mysql/MySqlDistributedQuota.js';
import { PublicMySqlQuota, cleanupExpiredPublicMySqlQuotas } from '../../server/mysql/PublicMySqlQuota.js';

const integration = process.env.MYSQL_QUOTA_EMULATOR_TEST === 'true' ? describe : describe.skip;
integration('MySQL distributed quota Firestore transactions', () => {
  let db;
  beforeAll(() => { db = new Firestore({ projectId: process.env.FIREBASE_PROJECT_ID }); });
  beforeEach(async () => { await Promise.all([db.recursiveDelete(db.collection('mysqlExecutionQuotas')), db.recursiveDelete(db.collection('mysqlExecutionRuntime')), db.recursiveDelete(db.collection('compilerPublicMysqlRateLimits')), db.recursiveDelete(db.collection('compilerPublicMysqlRuntime'))]); });
  afterAll(async () => { await Promise.all([db.recursiveDelete(db.collection('mysqlExecutionQuotas')), db.recursiveDelete(db.collection('mysqlExecutionRuntime')), db.recursiveDelete(db.collection('compilerPublicMysqlRateLimits')), db.recursiveDelete(db.collection('compilerPublicMysqlRuntime'))]); await db.terminate(); });

  it('coordinates simultaneous function instances and releases success/error leases', async () => {
    const policy = { maxRequests: 10, maxUserActive: 1, maxGlobalActive: 2, leaseMs: 1_000 };
    const instances = [new MySqlDistributedQuota({ db, policy }), new MySqlDistributedQuota({ db, policy })];
    const results = await Promise.allSettled(instances.map((quota) => quota.acquire('same-user')));
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const lease = results.find(({ status }) => status === 'fulfilled').value;
    await instances[0].release(lease);
    await expect(instances[1].acquire('same-user')).resolves.toMatchObject({ uid: 'same-user' });
  });

  it('reclaims expired leases and atomically enforces the global cap across users', async () => {
    let now = 100;
    const policy = { maxRequests: 10, maxUserActive: 1, maxGlobalActive: 1, leaseMs: 10 };
    const first = new MySqlDistributedQuota({ db, policy, now: () => now });
    const second = new MySqlDistributedQuota({ db, policy, now: () => now });
    await first.acquire('expiry-a');
    await expect(second.acquire('expiry-b')).rejects.toMatchObject({ code: 'mysql/busy' });
    now = 111;
    await expect(second.acquire('expiry-b')).resolves.toMatchObject({ uid: 'expiry-b' });
  });

  it('enforces public identity/global admission across instances and releases leases', async () => {
    const policy = { anonymousShortMax: 5, authenticatedShortMax: 5, anonymousLongMax: 5, authenticatedLongMax: 5, maxGlobalActive: 4, leaseMs: 75_000 };
    const instances = [new PublicMySqlQuota({ db, policy }), new PublicMySqlQuota({ db, policy })];
    const sameIdentity = await Promise.allSettled(instances.map((quota) => quota.acquire({ identity: 'address', authenticated: false })));
    expect(sameIdentity.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const first = sameIdentity.find(({ status }) => status === 'fulfilled').value;
    await instances[0].release(first);
    await expect(instances[1].acquire({ identity: 'address', authenticated: false })).resolves.toBeTruthy();
    await db.recursiveDelete(db.collection('compilerPublicMysqlRateLimits')); await db.recursiveDelete(db.collection('compilerPublicMysqlRuntime'));
    const globalPolicy = { ...policy, maxGlobalActive: 2 };
    const globalInstances = [new PublicMySqlQuota({ db, policy: globalPolicy }), new PublicMySqlQuota({ db, policy: globalPolicy })];
    const [one, two] = await Promise.all([globalInstances[0].acquire({ identity: 'one', authenticated: false }), globalInstances[1].acquire({ identity: 'two', authenticated: false })]);
    await expect(globalInstances[0].acquire({ identity: 'overflow', authenticated: false })).rejects.toMatchObject({ code: 'compiler/mysql-busy' });
    await globalInstances[0].release(one); await globalInstances[1].release(two);
  });

  it('recovers stale public leases, rolls rate windows, and cleans expired buckets', async () => {
    let now = 100; const quota = new PublicMySqlQuota({ db, now: () => now, policy: { leaseMs: 10, anonymousShortMax: 1, anonymousLongMax: 2, shortWindowMs: 20, longWindowMs: 100 } });
    await quota.acquire({ identity: 'stale', authenticated: false }); now = 111;
    await expect(quota.acquire({ identity: 'stale', authenticated: false })).rejects.toMatchObject({ code: 'compiler/mysql-public-rate-limit' });
    now = 121; const lease = await quota.acquire({ identity: 'stale', authenticated: false }); await quota.release(lease);
    now = 222; await expect(quota.acquire({ identity: 'stale', authenticated: false })).resolves.toBeTruthy();
    await db.collection('compilerPublicMysqlRateLimits').doc('expired').set({ expiresAt: now - 1 });
    await db.collection('compilerPublicMysqlRateLimits').doc('live').set({ expiresAt: now + 100 });
    expect(await cleanupExpiredPublicMySqlQuotas(db, now, 1)).toEqual({ deleted: 1 });
    expect((await db.collection('compilerPublicMysqlRateLimits').doc('live').get()).exists).toBe(true);
  });
});
