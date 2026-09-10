// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/auth/AuthService', () => ({ authService: {} }));
vi.mock('../../src/firebase/firebase', () => ({ useFirebaseEmulators: false }));
vi.mock('../../src/subscriptions/SubscriptionRepository', () => ({ SubscriptionRepository: class {} }));

const { SubscriptionPanel, subscriptionPlanPresentation } = await import('../../src/subscriptions/SubscriptionPanel.jsx');
const { openPremiumPlans } = await import('../../src/access/PremiumGate.jsx');
const free = { tier: 'FREE', active: false, planId: null, expiresAt: null };
const premium = { tier: 'PREMIUM', active: true, planId: 'monthly', expiresAt: new Date('2026-10-10T00:00:00Z') };
const user = { uid: 'local-user' };

describe('M4.2 subscription plan actions', () => {
  beforeEach(() => vi.stubGlobal('crypto', { randomUUID: () => 'request-ui-idempotency-0001' }));
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('routes Premium gates directly to the Subscription settings section', () => {
    window.history.replaceState({}, '', '/projects');
    openPremiumPlans();
    expect(window.location.pathname).toBe('/settings');
    expect(window.location.search).toBe('?section=subscription');
  });

  it('renders all canonical plan CTAs as honest disabled production actions', async () => {
    render(<SubscriptionPanel developmentGrantsEnabled={false} currentUser={user} repositoryFactory={() => ({ getCurrent: async () => free })} />);
    expect(subscriptionPlanPresentation.map(({ planId }) => planId)).toEqual(['monthly', 'half_yearly', 'annual']);
    expect(await screen.findByText('Free', { selector: 'strong' })).toBeTruthy();
    expect(screen.getByText('No active Premium subscription')).toBeTruthy();
    expect(screen.queryByText('Subscription status is unavailable.')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Get Premium' })).toHaveLength(3);
    screen.getAllByRole('button', { name: 'Get Premium' }).forEach((button) => expect(button.disabled).toBe(true));
    expect(screen.getAllByText('Payments coming soon.')).toHaveLength(3);
  });

  it('uses one authenticated development grant, blocks double-click, and waits for authoritative Premium', async () => {
    let release;
    const response = new Promise((resolve) => { release = resolve; });
    const fetchImpl = vi.fn(() => response);
    const getCurrent = vi.fn().mockResolvedValueOnce(free).mockResolvedValueOnce(premium);
    render(<SubscriptionPanel developmentGrantsEnabled currentUser={user} tokenProvider={async () => 'emulator-token'} repositoryFactory={() => ({ getCurrent })} fetchImpl={fetchImpl} />);
    await screen.findByText('Free', { selector: 'strong' });
    const buttons = screen.getAllByRole('button', { name: 'Get Premium' });
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /Granting/ }).disabled).toBe(true);
    expect(screen.getByText('Free', { selector: 'strong' })).toBeTruthy();
    release({ ok: true });
    expect(await screen.findByText('Premium', { selector: 'strong' })).toBeTruthy();
    expect(screen.getByText(/Current plan: monthly .* expires/)).toBeTruthy();
    const request = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(request).toEqual({ planId: 'monthly', requestId: 'request-ui-idempotency-0001' });
    expect(request).not.toHaveProperty('priceMinor');
  });

  it('keeps FREE on grant or entitlement-read failure', async () => {
    const { rerender } = render(<SubscriptionPanel developmentGrantsEnabled currentUser={user} tokenProvider={async () => 'emulator-token'} repositoryFactory={() => ({ getCurrent: async () => free })} fetchImpl={async () => ({ ok: false })} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Get Premium' }))[0]);
    expect((await screen.findByRole('alert')).textContent).toContain('rejected');
    expect(screen.getByText('Free', { selector: 'strong' })).toBeTruthy();
    rerender(<SubscriptionPanel developmentGrantsEnabled={false} currentUser={{ uid: 'another-user' }} repositoryFactory={() => ({ getCurrent: async () => { throw new Error('unavailable'); } })} />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('unavailable'));
    expect(screen.queryByText('Premium', { selector: 'strong' })).toBeNull();
  });
});
