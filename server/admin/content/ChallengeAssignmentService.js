import { ContentPublicationError } from './ContentPublicationError.js';

const REWARD_COINS = 20;
const ACTIVITY_VERSION = 'v1';
const dateInKolkata = (value) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value).filter(({ type }) => type !== 'literal').map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export class ChallengeAssignmentService {
  constructor({ db, delivery, now = () => new Date() }) { this.db = db; this.delivery = delivery; this.now = now; }

  async assign({ contentId, actor }) {
    const active = await this.delivery.resolveActive(contentId);
    if (!active || active.document.contentType !== 'CHALLENGE') throw new ContentPublicationError('challenge/not-active', 'An ACTIVE Challenge publication is required.', { status: 409 });
    const { document } = active;
    const { date, difficulty, reward } = document.content;
    if (date < dateInKolkata(this.now())) throw new ContentPublicationError('challenge/date-past', 'Past Challenge dates cannot be newly assigned.', { status: 409 });
    if (reward.coins !== REWARD_COINS || reward.streakIncrement !== 1) throw new ContentPublicationError('challenge/reward-policy', 'Challenge reward does not match the server policy.', { status: 422 });
    const pointerRef = this.db.doc(`publishedContent/${document.contentId}`);
    const assignmentRef = this.db.doc(`dailyChallenges/${date}`);
    const sameDateQuery = this.db.collection('dailyChallenges').where('date', '==', date);
    const assignment = {
      date, canonicalContentId: document.contentId, canonicalVersion: document.version,
      difficulty, rewardCoins: REWARD_COINS, rewardXp: 0, published: true,
      version: ACTIVITY_VERSION, policyVersion: 'canonical-challenge-v1',
      assignedBy: actor.uid, assignedAt: this.now().toISOString(),
    };
    await this.db.runTransaction(async (transaction) => {
      const [pointer, existing, sameDate] = await Promise.all([transaction.get(pointerRef), transaction.get(assignmentRef), transaction.get(sameDateQuery)]);
      if (existing.exists || !sameDate.empty) throw new ContentPublicationError('challenge/date-occupied', 'This date already has a daily Challenge assignment.', { status: 409 });
      if (!pointer.exists || pointer.data().publicationStatus !== 'ACTIVE' || pointer.data().contentType !== 'CHALLENGE' || pointer.data().activeVersion !== document.version) throw new ContentPublicationError('challenge/version-changed', 'The ACTIVE Challenge changed. Reload and retry.', { status: 409 });
      transaction.create(assignmentRef, assignment);
    });
    return { id: date, ...assignment };
  }
}
