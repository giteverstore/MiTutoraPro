import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createPayoutProvider } from '../../functions/src/payouts/PayoutProvider.js';
import { RazorpayXPayoutProvider } from '../../functions/src/payouts/providers/razorpayx/RazorpayXPayoutProvider.js';
import { RazorpayXPayoutCoordinator } from '../../functions/src/payouts/RazorpayXPayoutCoordinator.js';
import { PayoutReconciliationService } from '../../functions/src/payouts/PayoutReconciliationService.js';

const environment = { PAYOUT_PROVIDER: 'razorpayx', RAZORPAYX_KEY_ID: 'test-key', RAZORPAYX_KEY_SECRET: 'test-secret', RAZORPAYX_WEBHOOK_SECRET: 'webhook-secret', RAZORPAYX_ACCOUNT_NUMBER: 'test-account' };
const withdrawalId = 'withdrawal_1234567890abcdef';
const contact = { entity: 'contact', id: 'cont_12345678', reference_id: withdrawalId.slice(0, 40) };
const fund = { entity: 'fund_account', id: 'fa_12345678', contact_id: contact.id, account_type: 'vpa', active: true, vpa: { address: 'learner@upi' } };
const payout = (status = 'processing') => ({ entity: 'payout', id: 'pout_12345678', fund_account_id: fund.id, amount: 50_000, currency: 'INR', status, reference_id: withdrawalId.slice(0, 40) });
const response = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

describe('M8.7 RazorpayX payout provider', () => {
  it('selects RazorpayX explicitly and fails closed without configuration', () => {
    expect(createPayoutProvider({ environment, fetchImpl: vi.fn() })).toBeInstanceOf(RazorpayXPayoutProvider);
    expect(() => createPayoutProvider({ environment: { PAYOUT_PROVIDER: 'razorpayx' }, fetchImpl: vi.fn() })).toThrowError(expect.objectContaining({ code: 'payout/provider-unavailable' }));
  });

  it('creates a bounded contact and idempotent VPA fund account without logging the VPA', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(response(contact)).mockResolvedValueOnce(response(fund));
    const provider = new RazorpayXPayoutProvider({ environment, fetchImpl });
    expect(await provider.createContact({ withdrawalId })).toEqual({ providerContactId: contact.id });
    expect(await provider.createFundAccount({ providerContactId: contact.id, upiId: 'Learner@UPI' })).toEqual({ providerFundAccountId: fund.id });
    expect(fetchImpl.mock.calls[1][1].body).toContain('learner@upi');
  });

  it('uses server-derived X-Payout-Idempotency and normalizes all provider states', async () => {
    const fetchImpl = vi.fn(async () => response(payout('processing')));
    const provider = new RazorpayXPayoutProvider({ environment, fetchImpl });
    const evidence = await provider.createPayout({ withdrawalId, providerFundAccountId: fund.id, amountMinor: 50_000, currency: 'INR' });
    expect(evidence).toMatchObject({ status: 'PROCESSING', amountMinor: 50_000, currency: 'INR' });
    const header = fetchImpl.mock.calls[0][1].headers['X-Payout-Idempotency'];
    expect(header).toMatch(/^[a-f0-9]{32}$/);
    for (const [providerStatus, canonical] of Object.entries({ created: 'INITIATION_PENDING', pending: 'PROCESSING', queued: 'PROCESSING', initiated: 'PROCESSING', processing: 'PROCESSING', processed: 'PAID', rejected: 'FAILED', failed: 'FAILED', cancelled: 'CANCELLED', reversed: 'REVERSED' })) {
      expect(provider.normalizePayout(payout(providerStatus), { withdrawalId, providerFundAccountId: fund.id, amountMinor: 50_000, currency: 'INR', source: 'PROVIDER_RESPONSE', eventId: `event-${providerStatus}-0001` }).status).toBe(canonical);
    }
    expect(() => provider.normalizePayout(payout('mystery'), { withdrawalId, providerFundAccountId: fund.id, amountMinor: 50_000, currency: 'INR', source: 'PROVIDER_RESPONSE', eventId: 'event-mystery-0001' })).toThrowError(expect.objectContaining({ code: 'payout/provider-status-unsupported' }));
  });

  it('classifies ambiguous transport failure UNKNOWN and rejects binding mismatches', async () => {
    const provider = new RazorpayXPayoutProvider({ environment, fetchImpl: vi.fn(async () => { throw new Error('timeout'); }) });
    await expect(provider.createPayout({ withdrawalId, providerFundAccountId: fund.id, amountMinor: 50_000, currency: 'INR' })).rejects.toMatchObject({ code: 'payout/provider-unknown' });
    const bound = new RazorpayXPayoutProvider({ environment, fetchImpl: vi.fn() });
    for (const changed of [{ amount: 1 }, { currency: 'USD' }, { fund_account_id: 'fa_87654321' }, { reference_id: 'withdrawal_other' }]) {
      expect(() => bound.normalizePayout({ ...payout(), ...changed }, { withdrawalId, providerFundAccountId: fund.id, amountMinor: 50_000, currency: 'INR', source: 'PROVIDER_RESPONSE', eventId: 'event-binding-0001' })).toThrowError(expect.objectContaining({ code: 'payout/provider-binding-mismatch' }));
    }
  });

  it('fetches and reconciles provider-authoritative evidence', async () => {
    const provider = new RazorpayXPayoutProvider({ environment, fetchImpl: vi.fn(async () => response(payout('processed'))) });
    await expect(provider.reconcile({ withdrawalId, providerPayoutId: payout().id, providerFundAccountId: fund.id, amountMinor: 50_000, currency: 'INR' })).resolves.toMatchObject({ source: 'PROVIDER_RECONCILIATION', status: 'PAID' });
  });

  it('verifies raw-body webhooks, event identity, and canonical binding', async () => {
    const provider = new RazorpayXPayoutProvider({ environment, fetchImpl: vi.fn() });
    const rawBody = Buffer.from(JSON.stringify({ event: 'payout.processed', payload: { payout: { entity: payout('processed') } } }));
    const signature = createHmac('sha256', environment.RAZORPAYX_WEBHOOK_SECRET).update(rawBody).digest('hex');
    const evidence = await provider.verifyWebhook({ rawBody, headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': 'event-webhook-0001' }, resolveWithdrawal: async () => ({ withdrawalId, providerPayoutId: payout().id, providerFundAccountId: fund.id, amountMinor: 50_000, currency: 'INR' }) });
    expect(evidence).toMatchObject({ source: 'PROVIDER_WEBHOOK', status: 'PAID' });
    await expect(provider.verifyWebhook({ rawBody, headers: { 'x-razorpay-signature': '0'.repeat(64), 'x-razorpay-event-id': 'event-webhook-0001' }, resolveWithdrawal: vi.fn() })).rejects.toMatchObject({ code: 'payout/invalid-webhook-signature' });
  });

  it('passes the VPA only through the transient initiation chain and marks ambiguity UNKNOWN', async () => {
    const withdrawalService = {
      requestWithdrawal: vi.fn(async () => ({ withdrawalId, amountMinor: 50_000, currency: 'INR' })),
      applyProviderEvent: vi.fn(async (evidence) => evidence),
    };
    const provider = {
      createContact: vi.fn(async () => ({ providerContactId: contact.id })),
      createFundAccount: vi.fn(async ({ upiId }) => { expect(upiId).toBe('learner@upi'); return { providerFundAccountId: fund.id }; }),
      createPayout: vi.fn(async () => { throw Object.assign(new Error('timeout'), { code: 'payout/provider-unknown' }); }),
    };
    const coordinator = new RazorpayXPayoutCoordinator({ withdrawalService, provider });
    await expect(coordinator.requestAndInitiate({ principal: { uid: 'owner' }, request: { requestId: 'request-12345678', amountMinor: 50_000, upiId: 'learner@upi' } })).rejects.toMatchObject({ code: 'payout/provider-unknown' });
    expect(withdrawalService.applyProviderEvent).toHaveBeenCalledWith(expect.objectContaining({ status: 'UNKNOWN', amountMinor: 50_000, currency: 'INR' }));
    expect(JSON.stringify(withdrawalService.applyProviderEvent.mock.calls)).not.toContain('learner@upi');
  });

  it('reconciles a bounded batch and isolates individual provider failures', async () => {
    const repository = { listReconciliationCandidates: vi.fn(async () => [{ withdrawalId: 'withdrawal-a' }, { withdrawalId: 'withdrawal-b' }]) };
    const provider = { reconcile: vi.fn(async (record) => { if (record.withdrawalId.endsWith('b')) throw Object.assign(new Error('unknown'), { code: 'payout/provider-unknown' }); return { withdrawalId: record.withdrawalId }; }) };
    const withdrawalService = { applyProviderEvent: vi.fn(async (value) => ({ status: 'PAID', ...value })) };
    const service = new PayoutReconciliationService({ repository, provider, withdrawalService });
    expect(await service.reconcileBatch({ limit: 2 })).toEqual([{ withdrawalId: 'withdrawal-a', result: { status: 'PAID', withdrawalId: 'withdrawal-a' } }, { withdrawalId: 'withdrawal-b', errorCode: 'payout/provider-unknown' }]);
    await expect(service.reconcileBatch({ limit: 101 })).rejects.toMatchObject({ code: 'payout/invalid-limit' });
  });
});
