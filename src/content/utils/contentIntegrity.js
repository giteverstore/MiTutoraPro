import { CONTENT_ERROR_CODES, ContentError } from './ContentError.js';

export const isSha256 = (value) => /^[a-f0-9]{64}$/.test(String(value ?? '').toLowerCase());

export async function sha256Bytes(bytes) {
  const byteArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', byteArray);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyContentIntegrity(bytes, expectedHash, storagePath) {
  const normalizedHash = String(expectedHash ?? '').trim().toLowerCase();
  if (!isSha256(normalizedHash)) throw new ContentError(CONTENT_ERROR_CODES.integrityFailed, 'The published content integrity information is invalid.', { details: { storagePath } });
  const actualHash = await sha256Bytes(bytes);
  if (actualHash !== normalizedHash) throw new ContentError(CONTENT_ERROR_CODES.integrityFailed, 'This content could not be verified. Please retry.', { details: { storagePath, expectedHash: normalizedHash, actualHash } });
  return actualHash;
}
