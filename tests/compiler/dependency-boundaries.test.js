import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertBrowserDependencyBoundary,
  findServerDependencyImports,
  validateDependencyBoundaries,
} from '../../scripts/validate-dependency-boundaries.mjs';

const packageManifest = JSON.parse(readFileSync('package.json', 'utf8'));
const clientFixture = 'tests/fixtures/dependency-boundaries/client-imports-firebase-admin.js';
const serverFixture = 'tests/fixtures/dependency-boundaries/server-imports-firebase-admin.js';

describe('Firebase Admin dependency boundary', () => {
  it('fails closed when a browser module imports Firebase Admin', () => {
    expect(() => assertBrowserDependencyBoundary([clientFixture]))
      .toThrow(`Browser source imports a server-only Firebase dependency: ${clientFixture}`);
  });

  it('recognizes a server Firebase Admin import without globally allowing it in browser source', () => {
    expect(findServerDependencyImports([serverFixture])).toEqual([serverFixture]);
    expect(() => validateDependencyBoundaries({ packageManifest, browserFiles: [] })).not.toThrow();
  });

  it('requires Firebase Admin to remain available to production serverless functions', () => {
    expect(packageManifest.dependencies['firebase-admin']).toBeTruthy();
    expect(packageManifest.devDependencies?.['firebase-admin']).toBeUndefined();
  });
});
