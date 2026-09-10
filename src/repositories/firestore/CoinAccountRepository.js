import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firestore';
import { userCoinAccountSummaryPath } from './paths';

export class CoinAccountRepository {
  constructor(uid) {
    this.reference = doc(db, userCoinAccountSummaryPath(uid));
  }

  async getSummary() {
    const snapshot = await getDoc(this.reference);
    return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } : null;
  }
}
