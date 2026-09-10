import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/firestore';
import { userWalletAccountPath, userWalletTransactionsPath } from '../repositories/firestore/paths';

const zeroWallet = Object.freeze({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 0, lifetimeCreditedMinor: 0 });

export class WalletRepository {
  constructor(uid) { this.uid = uid; }
  async getWallet() {
    const snapshot = await getDoc(doc(db, userWalletAccountPath(this.uid)));
    return snapshot.exists() ? snapshot.data() : { ...zeroWallet };
  }
  async listTransactions() {
    const snapshot = await getDocs(query(collection(db, userWalletTransactionsPath(this.uid)), orderBy('createdAt', 'desc')));
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  }
  async listWithdrawals() {
    const snapshot = await getDocs(query(collection(db, `users/${this.uid}/withdrawals`), orderBy('requestedAt', 'desc')));
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  }
}
