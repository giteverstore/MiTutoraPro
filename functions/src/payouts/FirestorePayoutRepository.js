const STATES = Object.freeze(['INITIATION_PENDING', 'PROCESSING', 'UNKNOWN', 'PAID']);

export class FirestorePayoutRepository {
  constructor({ db }) { if (!db?.collectionGroup) throw new TypeError('FirestorePayoutRepository requires Firestore.'); this.db = db; }

  async findByProviderPayoutId(providerPayoutId) {
    const snapshot = await this.db.collectionGroup('withdrawals').where('providerPayoutId', '==', providerPayoutId).limit(2).get();
    if (snapshot.size !== 1) throw Object.assign(new Error('Provider payout binding was not found uniquely.'), { code: 'payout/provider-binding-mismatch' });
    return snapshot.docs[0].data();
  }

  async listReconciliationCandidates({ limit }) {
    const records = [];
    for (const status of STATES) {
      const snapshot = await this.db.collectionGroup('withdrawals').where('status', '==', status).limit(limit).get();
      for (const document of snapshot.docs) if (document.data().providerPayoutId) records.push(document.data());
    }
    return records.sort((a, b) => Number(a.updatedAt?.toMillis?.() ?? 0) - Number(b.updatedAt?.toMillis?.() ?? 0)).slice(0, limit);
  }
}
