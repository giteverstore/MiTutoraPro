const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i;

export const CONTENT_NAMESPACES = Object.freeze({ legacy: 'legacy', v2: 'v2' });

export function createV2CourseIdentity({ contentId, publicationVersion } = {}) {
  if (!SAFE_ID.test(String(contentId ?? ''))) throw new TypeError('A valid V2 contentId is required.');
  if (publicationVersion !== undefined && (!Number.isSafeInteger(publicationVersion) || publicationVersion < 1)) {
    throw new TypeError('publicationVersion must be a positive integer when supplied.');
  }
  return Object.freeze({
    namespace: CONTENT_NAMESPACES.v2,
    contentType: 'course',
    contentId,
    ...(publicationVersion === undefined ? {} : { publicationVersion }),
  });
}

export function v2ProgressKey(identity) {
  const value = createV2CourseIdentity(identity);
  if (!value.publicationVersion) throw new TypeError('V2 progress requires an exact publicationVersion.');
  return `v2:course:${value.contentId}:version:${value.publicationVersion}`;
}
