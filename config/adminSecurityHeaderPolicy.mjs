const freeze = (value) => Object.freeze(value);

export const ADMIN_DOCUMENT_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://apis.google.com",
  "style-src 'self'",
  "font-src 'self' data:",
  "img-src 'self' data: https:",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com",
  "frame-src https://*.firebaseapp.com https://accounts.google.com",
].join('; ');

export const ADMIN_DOCUMENT_SECURITY_HEADERS = freeze({
  'Content-Security-Policy': ADMIN_DOCUMENT_CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()',
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Frame-Options': 'DENY',
});

// Vite injects the React Refresh preamble and development styles into the
// document. Keep both inline allowances local to Vite development/preview.
const ADMIN_LOCAL_CSP = ADMIN_DOCUMENT_CSP
  .replace(
    "script-src 'self' 'wasm-unsafe-eval' https://apis.google.com",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://apis.google.com",
  )
  .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'");
export const ADMIN_LOCAL_SECURITY_HEADERS = freeze({
  ...Object.fromEntries(Object.entries(ADMIN_DOCUMENT_SECURITY_HEADERS).filter(([name]) => name !== 'Strict-Transport-Security')),
  'Content-Security-Policy': ADMIN_LOCAL_CSP,
});
