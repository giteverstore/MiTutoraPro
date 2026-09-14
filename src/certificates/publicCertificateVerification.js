import { callFirebaseFunction } from '../firebase/functions';

export const CERTIFICATE_ID_PATTERN = /^MIT-[A-Z0-9_-]{1,32}-[A-F0-9]{16}$/;

export function publicVerificationUrl(credentialId, { origin = globalThis.location?.origin, production = import.meta.env.PROD } = {}) {
  if (!CERTIFICATE_ID_PATTERN.test(credentialId ?? '')) throw new TypeError('A valid certificate credential ID is required.');
  const base = production ? 'https://ycoders.com' : origin;
  if (!base) throw new Error('The public application origin is unavailable.');
  return `${base.replace(/\/$/, '')}/verify/${encodeURIComponent(credentialId)}`;
}

export async function verifyPublicCertificate(credentialId) {
  if (!CERTIFICATE_ID_PATTERN.test(credentialId ?? '')) return { status: 'NOT_FOUND' };
  try { return await callFirebaseFunction('verifyPublicCertificate', { credentialId }); }
  catch (error) {
    const code = String(error?.code ?? '').replace('functions/', '');
    if (code === 'not-found' || code === 'invalid-argument') return { status: 'NOT_FOUND' };
    if (code === 'failed-precondition') return { status: 'REVOKED' };
    throw error;
  }
}
