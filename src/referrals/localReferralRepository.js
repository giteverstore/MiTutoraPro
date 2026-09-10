// Compatibility-only adapter retained for imports from older local tests.
// M5.1 deliberately provides no browser-side referral persistence or authority.
export function createLocalReferralRepository() {
  return Object.freeze({
    load: async () => null,
    save: async () => { throw new Error('Referral records are server-authoritative.'); },
    clear: async () => { throw new Error('Referral records are server-authoritative.'); },
  });
}
