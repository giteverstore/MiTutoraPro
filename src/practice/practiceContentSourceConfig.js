export const PRACTICE_CONTENT_SOURCES = Object.freeze({
  FIREBASE: 'firebase',
  LOCAL: 'local',
});

export function resolvePracticeContentSource({ isDevelopment, configuredSource }) {
  if (isDevelopment && configuredSource === PRACTICE_CONTENT_SOURCES.LOCAL) {
    return PRACTICE_CONTENT_SOURCES.LOCAL;
  }

  return PRACTICE_CONTENT_SOURCES.FIREBASE;
}
