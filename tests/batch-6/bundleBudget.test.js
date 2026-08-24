import { describe, expect, it } from 'vitest';
import {
  BUNDLE_BUDGETS,
  REQUIRED_LAZY_ROUTES,
  evaluateBundleBudget,
} from '../../scripts/performance/bundleBudget.mjs';

const heavyEntries = [
  'src/components/MonacoCodeEditor.jsx',
  'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs',
  'src/exam/services/SileroVadRuntime.js',
];

function validManifest() {
  return {
    'index.html': { file: 'assets/index.js', isEntry: true, css: ['assets/index.css'] },
    ...Object.fromEntries([...REQUIRED_LAZY_ROUTES, ...heavyEntries].map((key, index) => [
      key,
      { file: `assets/lazy-${index}.js`, isDynamicEntry: true },
    ])),
  };
}

const assets = (overrides = {}) => (file) => overrides[file] ?? {
  bytes: file.endsWith('.css') ? 10_000 : 100_000,
  gzipBytes: file.endsWith('.css') ? 2_000 : 25_000,
};

describe('Batch 6 bundle budgets', () => {
  it('accepts bounded entry assets and lazy domain/runtime entries', () => {
    expect(evaluateBundleBudget(validManifest(), assets()).failures).toEqual([]);
  });

  it('rejects an oversized initial application', () => {
    const result = evaluateBundleBudget(validManifest(), assets({
      'assets/index.js': {
        bytes: BUNDLE_BUDGETS.initialJavaScriptBytes + 1,
        gzipBytes: BUNDLE_BUDGETS.initialJavaScriptGzipBytes + 1,
      },
    }));
    expect(result.failures).toEqual(expect.arrayContaining([
      expect.stringContaining('Initial JavaScript is'),
      expect.stringContaining('Initial JavaScript gzip is'),
    ]));
  });

  it.each(heavyEntries)('rejects eager loading of %s', (entry) => {
    const manifest = validManifest();
    manifest['index.html'].imports = [entry];
    expect(evaluateBundleBudget(manifest, assets()).failures).toContain(
      `${entry} is part of the initial static graph.`,
    );
  });

  it('rejects a route that stops being a dynamic entry', () => {
    const manifest = validManifest();
    manifest[REQUIRED_LAZY_ROUTES[0]].isDynamicEntry = false;
    expect(evaluateBundleBudget(manifest, assets()).failures).toContain(
      `${REQUIRED_LAZY_ROUTES[0]} is not a dynamic route entry.`,
    );
  });
});
