import { collection, doc, getCountFromServer, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../firebase/firestore';

export class ActivityStateRepository {
  constructor(uid) { this.uid = uid; }
  async getStreakSummary() { const snapshot = await getDoc(doc(db, `users/${this.uid}/streak/summary`)); return snapshot.exists() ? snapshot.data() : null; }
  async listCompletions() { return (await getDocs(collection(db, `users/${this.uid}/activityCompletions`))).docs.map((item) => ({ id: item.id, ...item.data() })); }
  completionCollection() { return collection(db, `users/${this.uid}/activityCompletions`); }
  mapCompletions(snapshot) { return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })); }
  async getTodayChallengeCompletion(occurrenceDate) {
    const snapshot = await getDocs(query(this.completionCollection(), where('activityType', '==', 'DAILY_CHALLENGE'), where('occurrenceDate', '==', occurrenceDate), limit(1)));
    return this.mapCompletions(snapshot).find((item) => String(item.completionStatus).toUpperCase() === 'COMPLETED') ?? null;
  }
  async listCompletionsForDateRange(startDate, endDate) {
    const snapshot = await getDocs(query(this.completionCollection(), where('occurrenceDate', '>=', startDate), where('occurrenceDate', '<=', endDate)));
    return this.mapCompletions(snapshot).filter((item) => item.activityType === 'DAILY_CHALLENGE');
  }
  async listCompletionsForActivityType(activityType) {
    return this.mapCompletions(await getDocs(query(this.completionCollection(), where('activityType', '==', activityType))));
  }
  async countCompleted(activityType) {
    const snapshot = await getCountFromServer(query(this.completionCollection(), where('activityType', '==', activityType), where('completionStatus', '==', 'COMPLETED')));
    return snapshot.data().count;
  }
}
