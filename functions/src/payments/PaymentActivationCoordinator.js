import { SubscriptionService } from '../subscriptions/SubscriptionService.js';
import { ReferralService } from '../referrals/ReferralService.js';
import { isCapturedPayment } from './PaymentModels.js';
import { getSubscriptionPlan } from '../subscriptions/SubscriptionPlans.js';

export class PaymentActivationCoordinator {
  constructor({ db, timestamp, now, subscriptionService, referralService, pendingRewardCoordinator }) {
    if (!db?.doc || !db?.runTransaction || !timestamp?.now) throw new TypeError('PaymentActivationCoordinator requires Firestore and a timestamp factory.');
    this.db = db;
    this.subscriptionService = subscriptionService ?? new SubscriptionService({ db, timestamp, now });
    this.referralService = referralService ?? new ReferralService({ db, timestamp, now });
    this.pendingRewardCoordinator = pendingRewardCoordinator;
    this.timestamp = timestamp;
  }

  async activateFromCapturedPayment(paymentId) {
    const snapshot = await this.db.doc(`payments/${paymentId}`).get();
    const payment = snapshot?.exists ? snapshot.data() : null;
    if (!isCapturedPayment(payment)) throw Object.assign(new Error('A captured canonical payment is required.'), { code: 'payment/not-captured' });
    const plan = getSubscriptionPlan(payment.planId);
    if (payment.planVersion !== plan.version || payment.amountMinor !== plan.priceMinor || payment.currency !== plan.currency || !payment.ownerUid) {
      throw Object.assign(new Error('Captured payment does not match canonical plan authority.'), { code: 'payment/payment-mismatch' });
    }
    const activation = await this.subscriptionService.activateFromVerifiedPayment(paymentId);
    const qualification = await this.referralService.qualifyReferralFromVerifiedPurchase({
      trusted: true, evidenceType: 'VERIFIED_PREMIUM_PURCHASE', source: 'PAYMENT',
      purchaserUid: payment.ownerUid, purchaseId: payment.paymentId, planId: payment.planId,
      amountMinor: payment.amountMinor, currency: payment.currency,
    });
    if (qualification.qualified && !this.pendingRewardCoordinator?.recordPendingReferralReward) {
      throw Object.assign(new Error('Qualified referral pending-reward coordinator is unavailable.'), { code: 'payment/pending-reward-unavailable' });
    }
    if (qualification.qualified) {
      await this.pendingRewardCoordinator.recordPendingReferralReward({
        trusted: true, evidenceType: 'CAPTURED_PAYMENT_REFERRAL_PENDING',
        pendingId: `pending:${payment.paymentId}`, referralId: qualification.referralId,
      });
    }
    const orchestrationRef = this.db.doc(`purchaseOrchestrations/${paymentId}`);
    const completedAt = this.timestamp.now();
    await this.db.runTransaction(async (tx) => {
      const existing = await tx.get(orchestrationRef);
      const record = {
        paymentId, ownerUid: payment.ownerUid, planId: plan.planId,
        subscriptionId: activation.subscriptionId,
        referralId: qualification.qualified ? qualification.referralId : null,
        referralRewardState: qualification.qualified ? 'PENDING_ENSURED' : 'NOT_APPLICABLE',
        status: 'COMPLETE', completedAt, schemaVersion: '1.0.0',
      };
      if (existing.exists) {
        const stored = existing.data();
        if (stored.subscriptionId !== record.subscriptionId || stored.ownerUid !== record.ownerUid || stored.planId !== record.planId) {
          throw Object.assign(new Error('Purchase orchestration conflicts with durable completion state.'), { code: 'payment/orchestration-conflict' });
        }
      } else tx.create(orchestrationRef, record);
    });
    return { activation, qualification, orchestrationStatus: 'COMPLETE' };
  }
}
