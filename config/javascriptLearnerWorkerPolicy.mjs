export const JAVASCRIPT_LEARNER_WORKER_CSP = "default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'; worker-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'";
export const JAVASCRIPT_LEARNER_WORKER_ASSET_ROUTE = '/assets/javascript\\.worker-[A-Za-z0-9_-]+\\.js';
export const JAVASCRIPT_LEARNER_WORKER_REQUEST = /(?:\/assets\/javascript\.worker-[A-Za-z0-9_-]+\.js|\/src\/compiler\/runtimes\/javascript\/javascript\.worker\.js)(?:\?|$)/;
