const SAFE = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
export function createV2PracticeStateKey({ contentId, publicationVersion } = {}) {
  if (!SAFE.test(String(contentId ?? '')) || !Number.isSafeInteger(publicationVersion) || publicationVersion < 1) throw new TypeError('Valid V2 Practice state identity required.');
  return `v2_practice_${contentId}_version_${publicationVersion}`;
}
