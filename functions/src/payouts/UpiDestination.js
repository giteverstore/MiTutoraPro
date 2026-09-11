const CONTROL_OR_WHITESPACE = /[\p{Cc}\p{Cf}\p{Z}]/u;
const ASCII_VPA = /^[A-Za-z0-9][A-Za-z0-9._-]{0,98}@[A-Za-z0-9][A-Za-z0-9.-]{1,63}$/;

export function normalizeUpiId(value) {
  if (typeof value !== 'string' || value.length > 164 || CONTROL_OR_WHITESPACE.test(value) || !ASCII_VPA.test(value)) {
    throw Object.assign(new Error('The payout destination is invalid.'), { code: 'payout/invalid-destination' });
  }
  return value.toLowerCase();
}
export function maskUpiId(value) {
  const normalized = normalizeUpiId(value);
  const separator = normalized.indexOf('@');
  const handle = normalized.slice(0, separator);
  const provider = normalized.slice(separator + 1);
  const visible = handle.length === 1 ? '*' : `${handle[0]}${'*'.repeat(Math.min(6, Math.max(1, handle.length - 1)))}`;
  return `${visible}@${provider}`;
}
