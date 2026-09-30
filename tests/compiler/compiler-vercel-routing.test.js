import { describe, expect, it } from 'vitest';
import packageManifest from '../../package.json';
import { COMPILER_ISOLATION_ROUTE, createVercelConfig } from '../../vercel.mjs';

describe('compiler Vercel routing', () => {
  it('ships Firebase Admin as a production function dependency', () => {
    expect(packageManifest.dependencies['firebase-admin']).toBeTruthy();
    expect(packageManifest.devDependencies['firebase-admin']).toBeUndefined();
  });

  it.each(['main', 'compiler'])('routes nested compiler contracts through the single function for %s', (target) => {
    const config = createVercelConfig(target);
    expect(config.functions).toHaveProperty('api/compiler.js');
    expect(config.routes[0]).toEqual(COMPILER_ISOLATION_ROUTE);
    expect(config.routes[1]).toEqual({
      src: '/api/compiler(?:/(.*))?',
      dest: '/api/compiler?path=$1',
    });
  });

  it('scopes cross-origin isolation to compiler hostnames independent of build-time target variables', () => {
    for (const target of ['main', 'compiler']) expect(createVercelConfig(target).routes[0]).toEqual(COMPILER_ISOLATION_ROUTE);
    expect(COMPILER_ISOLATION_ROUTE.has).toEqual([expect.objectContaining({ type: 'header', key: 'host' })]);
    const hostPattern = new RegExp(`^(?:${COMPILER_ISOLATION_ROUTE.has[0].value})$`);
    expect(hostPattern.test('compiler.ycoders.com')).toBe(true);
    expect(hostPattern.test('ycoders-compiler.vercel.app')).toBe(true);
    expect(hostPattern.test('ycoders-compiler-feature.vercel.app')).toBe(true);
    expect(hostPattern.test('ycoders.com')).toBe(false);
    expect(COMPILER_ISOLATION_ROUTE.headers).toEqual({
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    });
  });
});
