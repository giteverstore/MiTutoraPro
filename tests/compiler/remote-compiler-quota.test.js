import { describe, expect, it } from 'vitest';
import { RemoteCompilerQuota } from '../../server/remote-compiler/RemoteCompilerQuota.js';

function transactionalStore() {
  const values = new Map(); let tail = Promise.resolve();
  const db = {
    doc: (path) => ({ path }),
    runTransaction: (operation) => {
      const current = tail.then(async () => operation({
        get: async ({ path }) => ({ exists: values.has(path), data: () => structuredClone(values.get(path)) }),
        set: ({ path }, value) => values.set(path, structuredClone(value)),
      }));
      tail = current.catch(() => undefined);
      return current;
    },
  };
  return { db, values };
}

describe('remote compiler distributed quota', () => {
  it('permits four global leases, rejects the fifth, and admits work after release', async () => {
    const { db, values } = transactionalStore(); const quota = new RemoteCompilerQuota({ db, now: () => 1_000 });
    const leases = await Promise.all(['u1', 'u2', 'u3', 'u4'].map((uid) => quota.acquire(uid)));
    await expect(quota.acquire('u5')).rejects.toMatchObject({ code: 'remote-compiler/busy', status: 429 });
    expect(Object.keys(values.get('remoteCompilerRuntime/global').leases)).toHaveLength(4);
    await quota.release(leases[0]);
    await expect(quota.acquire('u5')).resolves.toMatchObject({ uid: 'u5' });
  });

  it('enforces one active execution per learner', async () => {
    const { db } = transactionalStore(); const quota = new RemoteCompilerQuota({ db, now: () => 2_000 });
    await quota.acquire('same-user');
    await expect(quota.acquire('same-user')).rejects.toMatchObject({ code: 'remote-compiler/busy', status: 429 });
  });
});
