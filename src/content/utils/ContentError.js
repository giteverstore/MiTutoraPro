export const CONTENT_ERROR_CODES = Object.freeze({
  metadataMissing: 'content/metadata-missing',
  storageObjectMissing: 'content/storage-object-missing',
  malformedJson: 'content/malformed-json',
  invalidMetadata: 'content/invalid-metadata',
  unpublished: 'content/unpublished',
  downloadFailed: 'content/download-failed',
  networkTimeout: 'content/network-timeout',
  integrityFailed: 'content/integrity-failed',
  sizeExceeded: 'content/size-exceeded',
});

export class ContentError extends Error {
  constructor(code, message, { cause, details } = {}) {
    super(message, { cause });
    this.name = 'ContentError';
    this.code = code;
    this.details = details ?? null;
  }
}

export function isContentError(error, code) {
  return error instanceof ContentError && (!code || error.code === code);
}
