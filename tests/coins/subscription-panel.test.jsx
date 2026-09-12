// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/auth/AuthService', () => ({ authService: {} }));
vi.mock('../../src/firebase/firebase', () => ({ useFirebaseEmulators: false }));
vi.mock('../../src/subscriptions/SubscriptionRepository', () => ({ SubscriptionRepository: class {} }));

const { SubscriptionPanel, subscriptionPlanPresentation } = await import('../../src/subscriptions/SubscriptionPanel.jsx');
const { loadRazorpayCheckout } = await import('../../src/subscriptions/RazorpayCheckout.js');
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

  it('renders all canonical plan CTAs as one-time production purchase actions', async () => {
    render(<SubscriptionPanel developmentGrantsEnabled={false} currentUser={user} repositoryFactory={() => ({ getCurrent: async () => free })} />);
    expect(subscriptionPlanPresentation.map(({ planId }) => planId)).toEqual(['monthly', 'half_yearly', 'annual']);
    expect(await screen.findByText('Free', { selector: 'strong' })).toBeTruthy();
    expect(screen.getByText('No active Premium subscription')).toBeTruthy();
    expect(screen.queryByText('Subscription status is unavailable.')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Buy Premium' })).toHaveLength(3);
    screen.getAllByRole('button', { name: 'Buy Premium' }).forEach((button) => expect(button.disabled).toBe(false));
    expect(screen.getAllByText('Secure one-time payment. No auto-renewal.')).toHaveLength(3);
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

  it('opens one production checkout and waits for verified CAPTURED state before showing Premium', async () => {
    const getCurrent = vi.fn().mockResolvedValueOnce(free).mockResolvedValueOnce(premium);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ internalOrderId: 'order_internal', providerOrderId: 'order_12345678', keyId: 'rzp_test_public', amountMinor: 49_900, currency: 'INR', planId: 'monthly' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ paymentId: 'payment_internal', status: 'CAPTURED' }) });
    let checkoutOptions;
    const open = vi.fn();
    class Checkout { constructor(options) { checkoutOptions = options; } open() { open(); } }
    render(<SubscriptionPanel developmentGrantsEnabled={false} currentUser={user} tokenProvider={async () => 'firebase-token'} repositoryFactory={() => ({ getCurrent })} fetchImpl={fetchImpl} checkoutLoader={async () => Checkout} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Buy Premium' }))[0]);
    await waitFor(() => expect(checkoutOptions).toBeTruthy());
    expect(open).toHaveBeenCalledOnce();
    expect(screen.getByText('Free', { selector: 'strong' })).toBeTruthy();
    await checkoutOptions.handler({ razorpay_order_id: 'order_12345678', razorpay_payment_id: 'pay_1234567890', razorpay_signature: 'synthetic-signature' });
    expect(await screen.findByText('Premium', { selector: 'strong' })).toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ planId: 'monthly', requestId: 'request-ui-idempotency-0001' });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).not.toHaveProperty('amountMinor');
  });

  it('does not request an order when Checkout script loading fails', async () => {
    const fetchImpl = vi.fn(); const tokenProvider = vi.fn(); const logger = { warn: vi.fn() };
    render(<SubscriptionPanel developmentGrantsEnabled={false} currentUser={user} tokenProvider={tokenProvider} repositoryFactory={() => ({ getCurrent: async () => free })} fetchImpl={fetchImpl} checkoutLoader={async () => { throw new Error('blocked'); }} logger={logger} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Buy Premium' }))[0]);
    const alert = await screen.findByRole('alert');
    expect(alert.dataset.paymentFailureCategory).toBe('CHECKOUT_SCRIPT_LOAD_FAILED');
    expect(alert.textContent).toBe('Checkout could not be started. No payment was confirmed.');
    expect(tokenProvider).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('payment-checkout-failure', { category: 'CHECKOUT_SCRIPT_LOAD_FAILED' });
  });

  it('does not request an order when Checkout global is unavailable', async () => {
    const fetchImpl = vi.fn(); const tokenProvider = vi.fn();
    render(<SubscriptionPanel developmentGrantsEnabled={false} currentUser={user} tokenProvider={tokenProvider} repositoryFactory={() => ({ getCurrent: async () => free })} fetchImpl={fetchImpl} checkoutLoader={async () => undefined} logger={{ warn: vi.fn() }} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Buy Premium' }))[0]);
    expect((await screen.findByRole('alert')).dataset.paymentFailureCategory).toBe('CHECKOUT_GLOBAL_UNAVAILABLE');
    expect(tokenProvider).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not request an order when Firebase token acquisition fails', async () => {
    const fetchImpl = vi.fn(); const Checkout = vi.fn();
    render(<SubscriptionPanel developmentGrantsEnabled={false} currentUser={user} tokenProvider={async () => { throw new Error('private auth detail'); }} repositoryFactory={() => ({ getCurrent: async () => free })} fetchImpl={fetchImpl} checkoutLoader={async () => Checkout} logger={{ warn: vi.fn() }} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Buy Premium' }))[0]);
    expect((await screen.findByRole('alert')).dataset.paymentFailureCategory).toBe('AUTH_TOKEN_FAILED');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(Checkout).not.toHaveBeenCalled();
  });

  it('classifies an order HTTP failure without constructing Checkout', async () => {
    const Checkout = vi.fn();
    const logger = { warn: vi.fn() };
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: { code: 'payment/unavailable' } }) }));
    render(<SubscriptionPanel developmentGrantsEnabled={false} currentUser={user} tokenProvider={async () => 'firebase-token'} repositoryFactory={() => ({ getCurrent: async () => free })} fetchImpl={fetchImpl} checkoutLoader={async () => Checkout} logger={logger} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Buy Premium' }))[0]);
    expect((await screen.findByRole('alert')).dataset.paymentFailureCategory).toBe('ORDER_HTTP_FAILED');
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(Checkout).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('payment-checkout-failure', {
      category: 'ORDER_HTTP_FAILED', endpoint: '/api/payments/orders', method: 'POST', status: 503, serverCode: 'payment/unavailable',
    });
  });

  it('fails closed before Fetch when secure request ID generation fails', async () => {
    vi.stubGlobal('crypto', {});
    const Checkout = vi.fn(); const fetchImpl = vi.fn();
    render(<SubscriptionPanel developmentGrantsEnabled={false} currentUser={user} tokenProvider={async () => 'firebase-token'} repositoryFactory={() => ({ getCurrent: async () => free })} fetchImpl={fetchImpl} checkoutLoader={async () => Checkout} logger={{ warn: vi.fn() }} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Buy Premium' }))[0]);
    expect((await screen.findByRole('alert')).dataset.paymentFailureCategory).toBe('ORDER_REQUEST_ID_FAILED');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(Checkout).not.toHaveBeenCalled();
  });

  it('classifies a thrown Fetch as an order transport failure', async () => {
    const Checkout = vi.fn(); const logger = { warn: vi.fn() };
    const fetchImpl = vi.fn(async () => { throw Object.assign(new Error('private detail'), { name: 'TypeError' }); });
    render(<SubscriptionPanel developmentGrantsEnabled={false} currentUser={user} tokenProvider={async () => 'firebase-token'} repositoryFactory={() => ({ getCurrent: async () => free })} fetchImpl={fetchImpl} checkoutLoader={async () => Checkout} logger={logger} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Buy Premium' }))[0]);
    expect((await screen.findByRole('alert')).dataset.paymentFailureCategory).toBe('ORDER_TRANSPORT_FAILED');
    expect(logger.warn).toHaveBeenCalledWith('payment-checkout-failure', {
      category: 'ORDER_TRANSPORT_FAILED', endpoint: '/api/payments/orders', method: 'POST', exceptionName: 'TypeError',
    });
    expect(Checkout).not.toHaveBeenCalled();
  });

  it('rejects an invalid successful order response before constructing Checkout', async () => {
    const Checkout = vi.fn();
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ providerOrderId: 'order_12345678' }) }));
    render(<SubscriptionPanel developmentGrantsEnabled={false} currentUser={user} tokenProvider={async () => 'firebase-token'} repositoryFactory={() => ({ getCurrent: async () => free })} fetchImpl={fetchImpl} checkoutLoader={async () => Checkout} logger={{ warn: vi.fn() }} />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Buy Premium' }))[0]);
    expect((await screen.findByRole('alert')).dataset.paymentFailureCategory).toBe('ORDER_RESPONSE_INVALID');
    expect(Checkout).not.toHaveBeenCalled();
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

describe('Razorpay Checkout script loading', () => {
  afterEach(() => { document.head.innerHTML = ''; delete window.Razorpay; });

  it('deduplicates simultaneous loads and resolves only after the global exists', async () => {
    const first = loadRazorpayCheckout(document, window);
    const second = loadRazorpayCheckout(document, window);
    const scripts = document.querySelectorAll('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    expect(scripts).toHaveLength(1);
    class Checkout {}
    window.Razorpay = Checkout;
    scripts[0].dispatchEvent(new Event('load'));
    await expect(first).resolves.toBe(Checkout);
    await expect(second).resolves.toBe(Checkout);
  });

  it('removes a stale failed element before one bounded fresh load', async () => {
    const stale = document.createElement('script');
    stale.src = 'https://checkout.razorpay.com/v1/checkout.js';
    stale.dataset.mitutoraPaymentState = 'failed';
    document.head.append(stale);
    const pending = loadRazorpayCheckout(document, window);
    const scripts = document.querySelectorAll('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).not.toBe(stale);
    scripts[0].dispatchEvent(new Event('error'));
    await expect(pending).rejects.toMatchObject({ category: 'CHECKOUT_SCRIPT_LOAD_FAILED' });
  });
});
