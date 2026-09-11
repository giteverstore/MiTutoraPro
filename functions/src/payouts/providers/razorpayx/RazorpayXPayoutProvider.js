import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeUpiId } from '../../UpiDestination.js';

const API_BASE = 'https://api.razorpay.com/v1';
const IDS = Object.freeze({ contact: /^cont_[A-Za-z0-9]{8,64}$/, fund_account: /^fa_[A-Za-z0-9]{8,64}$/, payout: /^pout_[A-Za-z0-9]{8,80}$/ });
const EVENTS = new Set(['payout.pending', 'payout.queued', 'payout.initiated', 'payout.processing', 'payout.processed', 'payout.reversed', 'payout.failed', 'payout.cancelled', 'payout.rejected', 'payout.updated']);
const EVENT_ID = /^[A-Za-z0-9_.:-]{8,180}$/;
const STATUS = Object.freeze({ created: 'INITIATION_PENDING', pending: 'PROCESSING', queued: 'PROCESSING', initiated: 'PROCESSING', processing: 'PROCESSING', processed: 'PAID', failed: 'FAILED', rejected: 'FAILED', cancelled: 'CANCELLED', reversed: 'REVERSED' });
const TIMEOUT_MS = 15_000;

function fail(code, message, status = 400) { throw Object.assign(new Error(message), { code, status }); }
function required(environment, name) { const value = String(environment[name] ?? '').trim(); if (!value) fail('payout/provider-unavailable', 'Payout provider configuration is unavailable.', 503); return value; }
function entity(value, kind) { if (!value || value.entity !== kind || !IDS[kind]?.test(value.id ?? '')) fail('payout/provider-malformed-response', 'Payout provider returned invalid data.', 502); return value; }
function equalHex(left, right) { if (typeof right !== 'string' || !/^[a-f0-9]{64}$/i.test(right)) return false; const a = Buffer.from(left, 'hex'); const b = Buffer.from(right, 'hex'); return a.length === b.length && timingSafeEqual(a, b); }
function canonicalStatus(value) { const result = STATUS[value]; if (!result) fail('payout/provider-status-unsupported', 'Payout provider state is unsupported.', 409); return result; }
function canonicalKey(withdrawalId) { return createHash('sha256').update(`razorpayx\0${withdrawalId}`).digest('hex').slice(0, 32); }

export class RazorpayXPayoutProvider {
  constructor({ environment = process.env, fetchImpl = globalThis.fetch } = {}) {
    this.keyId = required(environment, 'RAZORPAYX_KEY_ID');
    this.keySecret = required(environment, 'RAZORPAYX_KEY_SECRET');
    this.webhookSecret = required(environment, 'RAZORPAYX_WEBHOOK_SECRET');
    this.accountNumber = required(environment, 'RAZORPAYX_ACCOUNT_NUMBER');
    if (typeof fetchImpl !== 'function') throw new TypeError('RazorpayXPayoutProvider requires fetch.');
    this.fetchImpl = fetchImpl;
  }

  async #request(path, options = {}) {
    const authorization = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    let response;
    try { response = await this.fetchImpl(`${API_BASE}${path}`, { ...options, signal: options.signal ?? AbortSignal.timeout(TIMEOUT_MS), headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json', ...(options.headers ?? {}) } }); }
    catch (cause) { throw Object.assign(new Error('Payout provider outcome is unknown.'), { code: 'payout/provider-unknown', status: 503, cause }); }
    if (!response?.ok) fail(response?.status === 429 ? 'payout/provider-rate-limited' : 'payout/provider-rejected', 'Payout provider rejected the request.', response?.status === 429 ? 429 : 502);
    try { return await response.json(); } catch { return fail('payout/provider-malformed-response', 'Payout provider returned invalid data.', 502); }
  }

  async createContact({ withdrawalId }) {
    const contact = entity(await this.#request('/contacts', { method: 'POST', body: JSON.stringify({ name: 'MiTutora learner', type: 'customer', reference_id: withdrawalId.slice(0, 40), notes: { withdrawal_id: withdrawalId } }) }), 'contact');
    if (contact.reference_id !== withdrawalId.slice(0, 40)) fail('payout/provider-binding-mismatch', 'Provider contact does not match the withdrawal.', 502);
    return Object.freeze({ providerContactId: contact.id });
  }

  async createFundAccount({ providerContactId, upiId }) {
    const normalized = normalizeUpiId(upiId);
    const account = entity(await this.#request('/fund_accounts', { method: 'POST', body: JSON.stringify({ contact_id: providerContactId, account_type: 'vpa', vpa: { address: normalized } }) }), 'fund_account');
    if (account.contact_id !== providerContactId || account.account_type !== 'vpa' || account.active !== true || normalizeUpiId(account.vpa?.address) !== normalized) fail('payout/provider-binding-mismatch', 'Provider fund account does not match the destination.', 502);
    return Object.freeze({ providerFundAccountId: account.id });
  }

  async createPayout({ withdrawalId, providerFundAccountId, amountMinor, currency }) {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || currency !== 'INR') fail('payout/invalid-request', 'Canonical payout data is invalid.');
    const payout = entity(await this.#request('/payouts', { method: 'POST', headers: { 'X-Payout-Idempotency': canonicalKey(withdrawalId) }, body: JSON.stringify({ account_number: this.accountNumber, fund_account_id: providerFundAccountId, amount: amountMinor, currency, mode: 'UPI', purpose: 'payout', queue_if_low_balance: true, reference_id: withdrawalId.slice(0, 40), notes: { withdrawal_id: withdrawalId } }) }), 'payout');
    return this.normalizePayout(payout, { withdrawalId, providerFundAccountId, amountMinor, currency, source: 'PROVIDER_RESPONSE', eventId: `response:${payout.id}:${payout.status}` });
  }

  async fetchPayout(providerPayoutId) { return entity(await this.#request(`/payouts/${encodeURIComponent(providerPayoutId)}`), 'payout'); }

  normalizePayout(payout, expected) {
    entity(payout, 'payout');
    if (expected.providerPayoutId && payout.id !== expected.providerPayoutId) fail('payout/provider-binding-mismatch', 'Provider payout identity does not match.', 502);
    if (payout.fund_account_id !== expected.providerFundAccountId || payout.amount !== expected.amountMinor || payout.currency !== expected.currency || payout.reference_id !== expected.withdrawalId.slice(0, 40)) fail('payout/provider-binding-mismatch', 'Provider payout does not match the withdrawal.', 502);
    return Object.freeze({ trusted: true, source: expected.source, eventId: expected.eventId, withdrawalId: expected.withdrawalId, status: canonicalStatus(payout.status), providerPayoutId: payout.id, providerContactId: expected.providerContactId, providerFundAccountId: payout.fund_account_id, amountMinor: payout.amount, currency: payout.currency });
  }

  async reconcile(record) {
    const payout = await this.fetchPayout(record.providerPayoutId);
    return this.normalizePayout(payout, { ...record, source: 'PROVIDER_RECONCILIATION', eventId: `reconciliation:${payout.id}:${payout.status}` });
  }

  async verifyWebhook({ rawBody, headers, resolveWithdrawal }) {
    if (!(rawBody instanceof Uint8Array)) fail('payout/invalid-webhook', 'Webhook raw body is required.');
    const signature = headers?.['x-razorpay-signature'] ?? headers?.['X-Razorpay-Signature'];
    const eventId = headers?.['x-razorpay-event-id'] ?? headers?.['X-Razorpay-Event-Id'];
    if (!equalHex(createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex'), signature)) fail('payout/invalid-webhook-signature', 'Webhook signature is invalid.', 401);
    if (!EVENT_ID.test(eventId ?? '')) fail('payout/invalid-webhook', 'Webhook event identity is invalid.');
    let payload; try { payload = JSON.parse(Buffer.from(rawBody).toString('utf8')); } catch { return fail('payout/invalid-webhook', 'Webhook payload is invalid.'); }
    if (!EVENTS.has(payload.event)) fail('payout/webhook-event-ignored', 'Webhook event is not supported.', 422);
    const payout = entity(payload.payload?.payout?.entity, 'payout');
    const withdrawal = await resolveWithdrawal(payout.id);
    return this.normalizePayout(payout, { ...withdrawal, source: 'PROVIDER_WEBHOOK', eventId });
  }
}

export function createRazorpayXPayoutProvider(options) { return new RazorpayXPayoutProvider(options); }
