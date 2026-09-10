// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getCurrent = vi.fn();
vi.mock('../../src/subscriptions/SubscriptionRepository', () => ({
  SubscriptionRepository: class {
    getCurrent(...args) { return getCurrent(...args); }
  },
}));

const { SubscriptionAccessProvider, useSubscriptionAccess } = await import('../../src/access/SubscriptionAccessContext.jsx');

function AccessProbe() {
  const access = useSubscriptionAccess();
  return <output data-status={access.status}>{access.tier}</output>;
}

describe('M4.2 bounded entitlement refresh', () => {
  afterEach(() => { cleanup(); getCurrent.mockReset(); });

  it('removes stale Premium access when the authoritative entitlement expires', async () => {
    getCurrent
      .mockResolvedValueOnce({ tier: 'PREMIUM', active: true, planId: 'monthly', expiresAt: new Date(Date.now() + 80) })
      .mockResolvedValueOnce({ tier: 'FREE', active: false, planId: null, expiresAt: null });
    render(<SubscriptionAccessProvider userId="learner"><AccessProbe /></SubscriptionAccessProvider>);
    await waitFor(() => expect(screen.getByText('PREMIUM').dataset.status).toBe('ready'));
    await waitFor(() => expect(screen.getByText('FREE').dataset.status).toBe('ready'), { timeout: 2_000 });
    expect(getCurrent).toHaveBeenCalledTimes(2);
  });

  it('fails closed while loading and when the authoritative read fails', async () => {
    let rejectRead;
    getCurrent.mockImplementation(() => new Promise((_resolve, reject) => { rejectRead = reject; }));
    render(<SubscriptionAccessProvider userId="learner"><AccessProbe /></SubscriptionAccessProvider>);
    expect(screen.getByText('FREE').dataset.status).toBe('loading');
    await waitFor(() => expect(typeof rejectRead).toBe('function'));
    rejectRead(new Error('unavailable'));
    await waitFor(() => expect(screen.getByText('FREE').dataset.status).toBe('error'));
  });
});
