export class PremiumAuthorization {
  constructor({ subscriptionService }) {
    if (!subscriptionService?.hasPremiumAccess) throw new TypeError('PremiumAuthorization requires SubscriptionService.');
    this.subscriptionService = subscriptionService;
  }

  async assert(uid) {
    const entitlement = await this.subscriptionService.hasPremiumAccess(uid);
    if (entitlement.tier !== 'PREMIUM') throw Object.assign(new Error('Premium is required for certification.'), { code: 'permission-denied' });
    return entitlement;
  }
}
