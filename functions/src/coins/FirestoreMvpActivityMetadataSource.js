export class FirestoreMvpActivityMetadataSource {
  constructor({ db }) {
    if (!db?.doc) throw new TypeError('Firestore activity metadata source requires Firestore.');
    this.db = db;
  }

  async loadPracticeMetadata(activityId, { transaction } = {}) {
    const reference = this.db.doc(`practiceQuestions/${activityId}`);
    const snapshot = transaction ? await transaction.get(reference) : await reference.get();
    return snapshot.exists ? snapshot.data() : null;
  }

  async loadDailyChallengeMetadata(activityId, { transaction } = {}) {
    const reference = this.db.doc(`dailyChallenges/${activityId}`);
    const snapshot = transaction ? await transaction.get(reference) : await reference.get();
    return snapshot.exists ? snapshot.data() : null;
  }
}
