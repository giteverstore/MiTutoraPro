import { describe, expect, it } from 'vitest';
import { HASHED_ASSET_CACHE_ROUTE, PRIVATE_API_CACHE_ROUTE, createVercelConfig } from '../../vercel.mjs';

const matches = (route, path) => new RegExp(route.src).test(path);

describe('HTTP cache policy', () => {
  it('caches only content-hashed Vite JavaScript and CSS assets immutably', () => {
    expect(HASHED_ASSET_CACHE_ROUTE.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    for (const path of ['/assets/index-BNiiKU2_.js', '/assets/home-I3Vxkicm.css']) expect(matches(HASHED_ASSET_CACHE_ROUTE, path)).toBe(true);
    for (const path of ['/assets/ui-icons/calendar.png', '/assets/config.js', '/index.html', '/api/activity/daily-login']) expect(matches(HASHED_ASSET_CACHE_ROUTE, path)).toBe(false);
  });

  it('keeps personalized APIs private without overriding public-content origin headers', () => {
    expect(PRIVATE_API_CACHE_ROUTE.headers['Cache-Control']).toBe('private, no-store');
    for (const path of ['/api/activity/daily-login', '/api/ai/history', '/api/ai/explain', '/api/bookmarks']) expect(matches(PRIVATE_API_CACHE_ROUTE, path)).toBe(true);
    for (const path of ['/api/admin-content/public', '/api/admin-content/public/course/1', '/assets/index-BNiiKU2_.js']) expect(matches(PRIVATE_API_CACHE_ROUTE, path)).toBe(false);
  });

  it('keeps the SPA entry outside immutable asset caching', () => {
    const config = createVercelConfig('main');
    expect(config.routes.filter((route) => matches(route, '/index.html')).some((route) => route.headers?.['Cache-Control']?.includes('immutable'))).toBe(false);
  });
});
