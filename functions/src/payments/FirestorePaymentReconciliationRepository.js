const RECONCILABLE_STATUSES = Object.freeze(['ORDER_CREATED', 'AUTHORIZED', 'CAPTURED', 'PARTIALLY_REFUNDED']);

export class FirestorePaymentReconciliationRepository {
  constructor({ db }) {
    if (!db?.collection) throw new TypeError('Payment reconciliation repository requires Firestore.');
    this.db = db;
  }

  async listUnresolved({ limit = 25 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw Object.assign(new Error('Reconciliation limit is invalid.'), { code: 'payment/invalid-reconciliation-limit' });
    }
    const snapshots = await Promise.all(RECONCILABLE_STATUSES.map((status) => this.db
      .collection('paymentOrders')
      .where('status', '==', status)
      .limit(limit)
      .get()));
    return snapshots
      .flatMap((snapshot) => snapshot.docs.map((entry) => entry.data()))
      .filter((record) => record.providerOrderState === 'CREATED'
        && typeof record.providerOrderId === 'string'
        && record.providerOrderId.length > 0)
      .sort((left, right) => (left.createdAt?.toMillis?.() ?? 0) - (right.createdAt?.toMillis?.() ?? 0))
      .slice(0, limit)
      .map((record) => Object.freeze({
        internalOrderId: record.internalOrderId,
        providerOrderId: record.providerOrderId,
        provider: record.provider,
        amountMinor: record.amountMinor,
        currency: record.currency,
        status: record.status,
      }));
  }
}
