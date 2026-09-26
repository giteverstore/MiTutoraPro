import { describe, expect, it } from 'vitest';
import { PublicMySqlQuota, publicMySqlIdentityHash } from '../../server/mysql/PublicMySqlQuota.js';

function store() {
  const values = new Map(); let tail = Promise.resolve();
  const db = { doc: (path) => ({ path }), runTransaction(operation) { const current = tail.then(() => operation({ get: async ({ path }) => ({ exists: values.has(path), data: () => structuredClone(values.get(path)) }), set: ({ path }, value) => values.set(path, structuredClone(value)) })); tail = current.catch(() => undefined); return current; } };
  return { db, values };
}

describe('public MySQL distributed quota', () => {
  it('enforces anonymous and authenticated rate windows separately', async () => {
    const { db } = store(); let now = 1_000; const quota = new PublicMySqlQuota({ db, now: () => now });
    for (let i = 0; i < 10; i += 1) { const lease = await quota.acquire({ identity: 'same', authenticated: false }); await quota.release(lease); }
    await expect(quota.acquire({ identity: 'same', authenticated: false })).rejects.toMatchObject({ code: 'compiler/mysql-public-rate-limit' });
    for (let i = 0; i < 20; i += 1) { const lease = await quota.acquire({ identity: 'same', authenticated: true }); await quota.release(lease); }
    await expect(quota.acquire({ identity: 'same', authenticated: true })).rejects.toMatchObject({ code: 'compiler/mysql-public-rate-limit' });
    expect(publicMySqlIdentityHash('address', 'same')).not.toBe(publicMySqlIdentityHash('uid', 'same'));
    now += 10 * 60_000; await expect(quota.acquire({ identity: 'same', authenticated: false })).resolves.toBeTruthy();
  });

  it('enforces one active lease per identity and four globally, then releases capacity', async () => {
    const { db } = store(); const quota = new PublicMySqlQuota({ db, now: () => 5_000 }); const first = await quota.acquire({ identity: 'one', authenticated: false });
    await expect(quota.acquire({ identity: 'one', authenticated: false })).rejects.toMatchObject({ code: 'compiler/mysql-public-concurrency' });
    const others = await Promise.all(['two', 'three', 'four'].map((identity) => quota.acquire({ identity, authenticated: false })));
    await expect(quota.acquire({ identity: 'five', authenticated: false })).rejects.toMatchObject({ code: 'compiler/mysql-busy', status: 503 });
    await quota.release(first); await expect(quota.acquire({ identity: 'five', authenticated: false })).resolves.toBeTruthy();
    await Promise.all(others.map((lease) => quota.release(lease)));
  });

  it('recovers capacity after the 75-second defensive lease expires', async () => {
    const { db } = store(); let now = 10_000; const quota = new PublicMySqlQuota({ db, now: () => now }); await quota.acquire({ identity: 'stale', authenticated: false }); now += 75_001;
    await expect(quota.acquire({ identity: 'stale', authenticated: false })).resolves.toBeTruthy();
  });
});
