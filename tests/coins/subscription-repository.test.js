import { beforeEach, describe, expect, it, vi } from 'vitest';

const snapshots = new Map();
vi.mock('../../src/firebase/firestore', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, path) => ({ path }),
  getDoc: async ({ path }) => snapshots.get(path) ?? { exists: () => false },
}));

const { SubscriptionRepository } = await import('../../src/subscriptions/SubscriptionRepository.js');
const snap = (data) => ({ exists: () => true, data: () => data });
const stamp = (value) => ({ toDate: () => new Date(value) });

describe('client Premium entitlement interpretation', () => {
  beforeEach(() => snapshots.clear());
  it('resolves absent and expired entitlement as FREE', async () => {
    const repository = new SubscriptionRepository('owner');
    await expect(repository.getCurrent(new Date('2026-01-01T00:00:00Z'))).resolves.toMatchObject({ tier: 'FREE' });
    snapshots.set('users/owner/entitlements/premium', snap({ ownerUid: 'owner', tier: 'PREMIUM', active: true, subscriptionId: 'sub', planId: 'monthly', expiresAt: stamp('2025-12-01T00:00:00Z') }));
    await expect(repository.getCurrent(new Date('2026-01-01T00:00:00Z'))).resolves.toMatchObject({ tier: 'FREE' });
  });
  it('requires an ACTIVE matching backing subscription', async () => {
    const entitlement = { ownerUid: 'owner', tier: 'PREMIUM', active: true, subscriptionId: 'sub', planId: 'monthly', expiresAt: stamp('2027-01-01T00:00:00Z') };
    snapshots.set('users/owner/entitlements/premium', snap(entitlement));
    snapshots.set('users/owner/subscriptions/sub', snap({ ownerUid: 'owner', planId: 'monthly', status: 'CANCELLED' }));
    const repository = new SubscriptionRepository('owner');
    await expect(repository.getCurrent(new Date('2026-01-01T00:00:00Z'))).resolves.toMatchObject({ tier: 'FREE' });
    snapshots.set('users/owner/subscriptions/sub', snap({ ownerUid: 'owner', planId: 'monthly', status: 'ACTIVE' }));
    await expect(repository.getCurrent(new Date('2026-01-01T00:00:00Z'))).resolves.toMatchObject({ tier: 'PREMIUM', planId: 'monthly' });
  });
  it('fails closed before following a mismatched entitlement owner', async () => {
    snapshots.set('users/owner/entitlements/premium', snap({ ownerUid: 'attacker', tier: 'PREMIUM', active: true, subscriptionId: 'sub', planId: 'monthly', expiresAt: stamp('2027-01-01T00:00:00Z') }));
    await expect(new SubscriptionRepository('owner').getCurrent(new Date('2026-01-01T00:00:00Z'))).resolves.toMatchObject({ tier: 'FREE' });
    expect(snapshots.has('users/attacker/subscriptions/sub')).toBe(false);
  });
});
