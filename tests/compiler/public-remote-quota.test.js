import { describe, expect, it } from 'vitest';
import { PublicRemoteCompilerQuota, publicRemoteIdentityHash } from '../../server/remote-compiler/PublicRemoteCompilerQuota.js';

function transactionalStore() {
  const values = new Map(); let tail = Promise.resolve();
  const db = {
    doc: (path) => ({ path }),
    runTransaction(operation) {
      const current = tail.then(() => operation({
        get: async ({ path }) => ({ exists: values.has(path), data: () => structuredClone(values.get(path)) }),
        set: ({ path }, value) => values.set(path, structuredClone(value)),
      }));
      tail = current.catch(() => undefined); return current;
    },
  };
  return { db, values };
}

describe('public remote compiler distributed quota', () => {
  it('enforces anonymous 10/10-minute and 30/hour windows', async () => {
    const { db } = transactionalStore(); let now = 1_000; const quota = new PublicRemoteCompilerQuota({ db, now: () => now });
    for (let index = 0; index < 10; index += 1) { const lease = await quota.acquire({ identity: 'address', authenticated: false, language: 'go' }); await quota.release(lease); }
    await expect(quota.acquire({ identity: 'address', authenticated: false, language: 'go' })).rejects.toMatchObject({ code: 'compiler/public-rate-limit', status: 429 });
    now += 10 * 60_000;
    for (let index = 0; index < 20; index += 1) { const lease = await quota.acquire({ identity: 'address', authenticated: false, language: 'rust' }); await quota.release(lease); if ((index + 1) % 10 === 0) now += 10 * 60_000; }
    await expect(quota.acquire({ identity: 'address', authenticated: false, language: 'go' })).rejects.toMatchObject({ code: 'compiler/public-rate-limit' });
  });

  it('allows authenticated identities 20/10-minute and keeps identity classes separate', async () => {
    const { db } = transactionalStore(); const quota = new PublicRemoteCompilerQuota({ db, now: () => 5_000 });
    for (let index = 0; index < 20; index += 1) { const lease = await quota.acquire({ identity: 'same-value', authenticated: true, language: 'go' }); await quota.release(lease); }
    await expect(quota.acquire({ identity: 'same-value', authenticated: true, language: 'go' })).rejects.toMatchObject({ code: 'compiler/public-rate-limit' });
    const anonymous = await quota.acquire({ identity: 'same-value', authenticated: false, language: 'go' });
    expect(anonymous.identityHash).not.toBe(publicRemoteIdentityHash('uid', 'same-value'));
  });

  it('enforces one active execution per identity and releases capacity', async () => {
    const { db } = transactionalStore(); const quota = new PublicRemoteCompilerQuota({ db, now: () => 7_000 });
    const lease = await quota.acquire({ identity: 'one', authenticated: false, language: 'go' });
    await expect(quota.acquire({ identity: 'one', authenticated: false, language: 'rust' })).rejects.toMatchObject({ code: 'compiler/public-concurrency-limit' });
    await quota.release(lease);
    await expect(quota.acquire({ identity: 'one', authenticated: false, language: 'rust' })).resolves.toBeTruthy();
  });

  it('bounds aggregate admitted work to four active plus eight queued', async () => {
    const { db } = transactionalStore(); const quota = new PublicRemoteCompilerQuota({ db, now: () => 9_000 });
    await Promise.all(Array.from({ length: 12 }, (_, index) => quota.acquire({ identity: `identity-${index}`, authenticated: false, language: 'go' })));
    await expect(quota.acquire({ identity: 'identity-13', authenticated: false, language: 'go' })).rejects.toMatchObject({ code: 'compiler/runner-busy', status: 503 });
  });

  it('prunes stale leases after the bounded recovery window', async () => {
    const { db } = transactionalStore(); let now = 10_000; const quota = new PublicRemoteCompilerQuota({ db, now: () => now, policy: { leaseMs: 100 } });
    await quota.acquire({ identity: 'stale', authenticated: false, language: 'go' }); now += 101;
    await expect(quota.acquire({ identity: 'stale', authenticated: false, language: 'go' })).resolves.toBeTruthy();
  });
});
