import { describe, expect, it } from 'vitest';
import packageManifest from '../../package.json';
import { createVercelConfig } from '../../vercel.mjs';

describe('compiler Vercel routing', () => {
  it('ships Firebase Admin as a production function dependency', () => {
    expect(packageManifest.dependencies['firebase-admin']).toBeTruthy();
    expect(packageManifest.devDependencies['firebase-admin']).toBeUndefined();
  });

  it.each(['main', 'compiler'])('routes nested compiler contracts through the single function for %s', (target) => {
    const config = createVercelConfig(target);
    expect(config.functions).toHaveProperty('api/compiler.js');
    expect(config.routes[0]).toEqual({
      src: '/api/compiler(?:/(.*))?',
      dest: '/api/compiler?path=$1',
    });
  });

  it('enables cross-origin isolation only for the standalone compiler deployment', () => {
    expect(createVercelConfig('main').headers).toBeUndefined();
    expect(createVercelConfig('compiler').headers).toEqual([{
      source: '/(.*)',
      headers: [
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
      ],
    }]);
  });
});
