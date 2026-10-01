import { describe, expect, it } from 'vitest';
import packageManifest from '../../package.json';
import {
  COMPILER_ISOLATION_ROUTE,
  JAVASCRIPT_LEARNER_WORKER_ROUTE,
  createVercelConfig,
} from '../../vercel.mjs';
import {
  API_SECURITY_ROUTE,
  COMPILER_ISOLATION_HEADERS,
  DOCUMENT_SECURITY_HEADERS,
  DOCUMENT_SECURITY_ROUTE,
} from '../../config/securityHeaderPolicy.mjs';

describe('compiler Vercel routing', () => {
  it('ships Firebase Admin as a production function dependency', () => {
    expect(packageManifest.dependencies['firebase-admin']).toBeTruthy();
    expect(packageManifest.devDependencies['firebase-admin']).toBeUndefined();
  });

  it.each(['main', 'compiler'])('does not rely on experimental Node module flags for %s', (target) => {
    expect(createVercelConfig(target).env?.NODE_OPTIONS).toBeUndefined();
  });

  it.each(['main', 'compiler'])('routes nested compiler contracts through the single function for %s', (target) => {
    const config = createVercelConfig(target);
    expect(config.functions).toHaveProperty('api/compiler.js');
    expect(config.routes).toContainEqual(COMPILER_ISOLATION_ROUTE);
    expect(config.routes).toContainEqual({
      src: '/api/compiler(?:/(.*))?',
      dest: '/api/compiler?path=$1',
    });
  });

  it('scopes cross-origin isolation to compiler hostnames independent of build-time target variables', () => {
    for (const target of ['main', 'compiler']) expect(createVercelConfig(target).routes).toContainEqual(COMPILER_ISOLATION_ROUTE);
    expect(COMPILER_ISOLATION_ROUTE.has).toEqual([expect.objectContaining({ type: 'header', key: 'host' })]);
    const hostPattern = new RegExp(`^(?:${COMPILER_ISOLATION_ROUTE.has[0].value})$`);
    expect(hostPattern.test('compiler.ycoders.com')).toBe(true);
    expect(hostPattern.test('ycoders-compiler.vercel.app')).toBe(true);
    expect(hostPattern.test('ycoders-compiler-feature.vercel.app')).toBe(true);
    expect(hostPattern.test('ycoders.com')).toBe(false);
    expect(COMPILER_ISOLATION_ROUTE.headers).toEqual(COMPILER_ISOLATION_HEADERS);
    expect(COMPILER_ISOLATION_ROUTE.headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
    expect(DOCUMENT_SECURITY_HEADERS).not.toHaveProperty('Cross-Origin-Embedder-Policy');
    expect(DOCUMENT_SECURITY_HEADERS).not.toHaveProperty('Cross-Origin-Opener-Policy');
  });

  it.each(['main', 'compiler'])('applies centralized document and API policy for %s', (target) => {
    const config = createVercelConfig(target);
    expect(config.routes).toContainEqual(DOCUMENT_SECURITY_ROUTE);
    expect(config.routes).toContainEqual(API_SECURITY_ROUTE);
    expect(DOCUMENT_SECURITY_HEADERS).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Frame-Options': 'DENY',
    });
    expect(DOCUMENT_SECURITY_HEADERS['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(DOCUMENT_SECURITY_HEADERS['Permissions-Policy']).toContain('camera=(self)');
    expect(DOCUMENT_SECURITY_HEADERS['Permissions-Policy']).toContain('geolocation=()');
    expect(API_SECURITY_ROUTE.headers).not.toHaveProperty('Content-Security-Policy');
    expect(API_SECURITY_ROUTE.headers['Referrer-Policy']).toBe('no-referrer');
  });

  it('applies a deny-network policy only to the JavaScript learner worker asset', () => {
    for (const target of ['main', 'compiler']) {
      const routes = createVercelConfig(target).routes;
      expect(routes).toContainEqual(JAVASCRIPT_LEARNER_WORKER_ROUTE);
      expect(routes.indexOf(JAVASCRIPT_LEARNER_WORKER_ROUTE)).toBeGreaterThan(routes.indexOf(DOCUMENT_SECURITY_ROUTE));
    }
    expect(JAVASCRIPT_LEARNER_WORKER_ROUTE.headers['Content-Security-Policy']).toContain("connect-src 'none'");
    expect(JAVASCRIPT_LEARNER_WORKER_ROUTE.headers['Content-Security-Policy']).toContain("worker-src 'none'");
  });
});
