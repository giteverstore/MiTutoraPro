import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore';
import { db } from '../../firebase/firestore';

export class CoinRedemptionRepository {
  constructor(uid) { this.uid = uid; }
  async getBalance() { const snap = await getDoc(doc(db, `users/${this.uid}/coinAccount/summary`)); return snap.exists() ? snap.data().availableBalance : 0; }
  async listRedemptions() { return (await getDocs(collection(db, `users/${this.uid}/coinRedemptions`))).docs.map((item) => ({ id: item.id, ...item.data() })); }
  async getUnlock(date) { const snap = await getDoc(doc(db, `users/${this.uid}/challengeUnlocks/${date}`)); return snap.exists() ? snap.data() : null; }
  async listTransactions({ pageSize = 25, cursor = null } = {}) {
    const clauses = [orderBy('createdAt', 'desc'), limit(pageSize)]; if (cursor) clauses.splice(1, 0, startAfter(cursor));
    const snap = await getDocs(query(collection(db, `users/${this.uid}/coinTransactions`), ...clauses));
    return { items: snap.docs.map((item) => ({ id: item.id, ...item.data() })), cursor: snap.docs.at(-1) ?? null, hasMore: snap.size === pageSize };
  }
}
