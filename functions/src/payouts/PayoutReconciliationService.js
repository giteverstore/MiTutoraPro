export class PayoutReconciliationService {
  constructor({ repository, provider, withdrawalService }) {
    if (!repository?.listReconciliationCandidates || !provider?.reconcile || !withdrawalService?.applyProviderEvent) throw new TypeError('PayoutReconciliationService dependencies are required.');
    this.repository = repository; this.provider = provider; this.withdrawalService = withdrawalService;
  }

  async reconcileBatch({ limit = 25 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Object.assign(new Error('Reconciliation limit is invalid.'), { code: 'payout/invalid-limit' });
    const records = await this.repository.listReconciliationCandidates({ limit });
    const results = [];
    for (const record of records) {
      try { results.push({ withdrawalId: record.withdrawalId, result: await this.withdrawalService.applyProviderEvent(await this.provider.reconcile(record)) }); }
      catch (error) { results.push({ withdrawalId: record.withdrawalId, errorCode: error?.code ?? 'payout/reconciliation-failed' }); }
    }
    return results;
  }
}
