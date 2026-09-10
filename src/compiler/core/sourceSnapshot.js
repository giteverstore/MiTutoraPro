export async function createSourceSnapshotHash(source) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure source snapshot hashing is unavailable.');
  const bytes = new TextEncoder().encode(String(source));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
