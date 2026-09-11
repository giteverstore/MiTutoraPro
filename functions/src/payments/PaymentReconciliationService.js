const FINANCIAL_LIFECYCLE_STATES = new Set(['PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'REVERSED']);

export class PaymentReconciliationService {
  constructor({ paymentRepository, providerAdapter, paymentService, purchaseCoordinator, lifecycleCoordinator = null }) {
    if (!paymentRepository?.listUnresolved || !providerAdapter?.fetchCanonicalEvidence || !paymentService?.recordVerifiedEvent || !purchaseCoordinator?.activateFromCapturedPayment) {
      throw new TypeError('Payment reconciliation dependencies are required.');
    }
    this.paymentRepository = paymentRepository; this.providerAdapter = providerAdapter;
    this.paymentService = paymentService; this.purchaseCoordinator = purchaseCoordinator;
    this.lifecycleCoordinator = lifecycleCoordinator;
  }

  async reconcile({ limit = 25 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Object.assign(new Error('Reconciliation limit is invalid.'), { code: 'payment/invalid-reconciliation-limit' });
    const unresolved = await this.paymentRepository.listUnresolved({ limit });
    const results = [];
    for (const record of unresolved) {
      const evidence = await this.providerAdapter.fetchCanonicalEvidence(record);
      const canonical = await this.paymentService.recordVerifiedEvent({ ...evidence, trusted: true, source: 'PROVIDER_RECONCILIATION' });
      if (canonical.paymentId !== record.paymentId && record.paymentId) throw Object.assign(new Error('Provider reconciliation does not match canonical identity.'), { code: 'payment/reconciliation-mismatch' });
      const orchestration = canonical.status === 'CAPTURED' ? await this.purchaseCoordinator.activateFromCapturedPayment(canonical.paymentId) : null;
      if (FINANCIAL_LIFECYCLE_STATES.has(canonical.status)) {
        if (!this.lifecycleCoordinator?.apply) throw Object.assign(new Error('Financial lifecycle coordinator is unavailable.'), { code: 'payment/lifecycle-coordinator-unavailable' });
        await this.lifecycleCoordinator.apply({ canonical, evidence: { ...evidence, source: 'PROVIDER_RECONCILIATION' } });
      }
      results.push({ paymentId: canonical.paymentId, status: canonical.status, orchestrationStatus: orchestration?.orchestrationStatus ?? null });
    }
    return results;
  }
}
