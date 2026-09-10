import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/firestore';

export class ActivityStateRepository {
  constructor(uid) { this.uid = uid; }
  async getStreakSummary() { const snapshot = await getDoc(doc(db, `users/${this.uid}/streak/summary`)); return snapshot.exists() ? snapshot.data() : null; }
  async listCompletions() { return (await getDocs(collection(db, `users/${this.uid}/activityCompletions`))).docs.map((item) => ({ id: item.id, ...item.data() })); }
}
