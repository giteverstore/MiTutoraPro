export const WEBR_VERSION = '0.6.0';
export const R_VERSION = '4.6.0';
export const R_EXECUTION_TIMEOUT_MS = 10_000;
export const R_INITIALIZATION_TIMEOUT_MS = 30_000;

export function getWebRBaseUrl() {
  const basePath = import.meta.env.BASE_URL || '/';
  return new URL(`${basePath}webr/`, globalThis.location?.origin ?? 'http://localhost').href;
}
