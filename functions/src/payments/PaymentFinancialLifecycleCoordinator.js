import { SETTLEMENT_STATE } from './ReferralSettlementService.js';

const ADVERSE_STATES = new Set([
  SETTLEMENT_STATE.PARTIALLY_REFUNDED,
  SETTLEMENT_STATE.REFUNDED,
  SETTLEMENT_STATE.DISPUTED,
  SETTLEMENT_STATE.REVERSED,
]);

export class PaymentFinancialLifecycleCoordinator {
  constructor({ referralSettlementService, entitlementService }) {
    if (!referralSettlementService?.applyTrustedEvidence || !entitlementService?.recomputePremiumEntitlement) {
      throw new TypeError('Payment financial lifecycle dependencies are required.');
    }
    this.referralSettlementService = referralSettlementService;
    this.entitlementService = entitlementService;
  }

  async apply({ canonical, evidence }) {
    if (!canonical?.paymentId || !canonical?.ownerUid || !evidence?.eventId || !ADVERSE_STATES.has(canonical.status)) {
      throw Object.assign(new Error('Canonical financial lifecycle evidence is invalid.'), { code: 'payment/invalid-lifecycle-evidence' });
    }
    const entitlement = await this.entitlementService.recomputePremiumEntitlement(canonical.ownerUid);
    let referral;
    try {
      referral = await this.referralSettlementService.applyTrustedEvidence({
        trusted: true,
        source: evidence.source,
        provider: evidence.provider,
        evidenceId: evidence.eventId,
        paymentId: canonical.paymentId,
        state: canonical.status,
        refundedAmountMinor: evidence.refundedAmountMinor ?? 0,
        currency: evidence.currency,
        occurredAt: evidence.occurredAt ?? null,
      });
    } catch (error) {
      if (error?.code !== 'settlement/referral-not-found') throw error;
      referral = { state: 'NOT_APPLICABLE', duplicate: false };
    }
    return Object.freeze({ referral, entitlement });
  }

  async resolveFavorable({ canonical, evidence }) {
    if (!canonical?.paymentId || !canonical?.ownerUid || !evidence?.eventId || !['CAPTURED', 'PARTIALLY_REFUNDED'].includes(canonical.status)) {
      throw Object.assign(new Error('Favorable lifecycle evidence is invalid.'), { code: 'payment/invalid-lifecycle-evidence' });
    }
    const entitlement = await this.entitlementService.recomputePremiumEntitlement(canonical.ownerUid);
    let referral;
    try {
      referral = await this.referralSettlementService.applyTrustedEvidence({
        trusted: true, source: evidence.source, provider: evidence.provider,
        evidenceId: evidence.eventId, paymentId: canonical.paymentId,
        state: SETTLEMENT_STATE.SETTLED, refundedAmountMinor: evidence.refundedAmountMinor ?? 0,
        currency: evidence.currency, occurredAt: evidence.occurredAt ?? null,
      });
    } catch (error) {
      if (error?.code !== 'settlement/referral-not-found') throw error;
      referral = { state: 'NOT_APPLICABLE', duplicate: false };
    }
    return Object.freeze({ referral, entitlement });
  }
}
