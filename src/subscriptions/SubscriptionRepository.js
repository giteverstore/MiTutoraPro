import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firestore';
import { userPremiumEntitlementPath, userSubscriptionPath } from '../repositories/firestore/paths';

export class SubscriptionRepository {
  constructor(uid) { this.uid = uid; this.reference = doc(db, userPremiumEntitlementPath(uid)); }
  async getCurrent(now = new Date()) {
    const snapshot = await getDoc(this.reference);
    if (!snapshot.exists()) return { tier: 'FREE', active: false, planId: null, expiresAt: null };
    const value = snapshot.data();
    const expiresAt = value.expiresAt?.toDate?.() ?? null;
    if (value.ownerUid !== this.uid || value.active !== true || value.tier !== 'PREMIUM' || !value.subscriptionId || !expiresAt || expiresAt <= now) return { tier: 'FREE', active: false, planId: null, expiresAt: null };
    const subscription = await getDoc(doc(db, userSubscriptionPath(this.uid, value.subscriptionId)));
    const history = subscription.exists() ? subscription.data() : null;
    if (history?.status !== 'ACTIVE' || history?.ownerUid !== value.ownerUid || history?.planId !== value.planId) return { tier: 'FREE', active: false, planId: null, expiresAt: null };
    return { tier: 'PREMIUM', active: true, planId: value.planId, expiresAt };
  }
}
