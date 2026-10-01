const freeze = (value) => Object.freeze(value);

export const DOCUMENT_CSP = [
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.razorpay.com",
].join('; ');

export const DOCUMENT_SECURITY_HEADERS = freeze({
  'Content-Security-Policy': DOCUMENT_CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': [
    'camera=(self)',
    'microphone=(self)',
    'fullscreen=(self)',
    'payment=(self)',
    'geolocation=()',
    'accelerometer=()',
    'gyroscope=()',
    'magnetometer=()',
    'usb=()',
    'serial=()',
    'bluetooth=()',
  ].join(', '),
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Frame-Options': 'DENY',
});

export const API_SECURITY_HEADERS = freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()',
  'Strict-Transport-Security': 'max-age=31536000',
});

export const COMPILER_ISOLATION_HEADERS = freeze({
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
});

export const LOCAL_DEVELOPMENT_HEADERS = freeze({
  ...Object.fromEntries(Object.entries(DOCUMENT_SECURITY_HEADERS)
    .filter(([name]) => name !== 'Strict-Transport-Security')),
  ...COMPILER_ISOLATION_HEADERS,
});

export const DOCUMENT_SECURITY_ROUTE = freeze({
  src: '/((?!api(?:/|$)).*)',
  headers: DOCUMENT_SECURITY_HEADERS,
  continue: true,
});

export const API_SECURITY_ROUTE = freeze({
  src: '/api/(.*)',
  headers: API_SECURITY_HEADERS,
  continue: true,
});
