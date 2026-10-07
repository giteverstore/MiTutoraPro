export const DRAFT_LIFECYCLE = Object.freeze({
  DRAFT: 'DRAFT', VALIDATED: 'VALIDATED', PUBLISHING: 'PUBLISHING', PUBLISHED: 'PUBLISHED',
});

export const PUBLICATION_STATUS = Object.freeze({
  CREATING: 'CREATING', READY: 'READY', FAILED: 'FAILED', ARCHIVED: 'ARCHIVED',
});

export const MAX_DRAFT_BYTES = 850_000;
export const MAX_ARTIFACT_BYTES = 4_000_000;

export const safeContentId = (value) => {
  const id = String(value ?? '').trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(id)) throw new TypeError('contentId contains unsupported characters.');
  return id;
};

export function jsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function assertContentSize(value, limit, label) {
  const size = jsonBytes(value);
  if (size > limit) {
    const error = new Error(`${label} exceeds supported size. Move large media into Assets.`);
    error.code = 'content/size-limit';
    error.status = 413;
    throw error;
  }
  return size;
}
