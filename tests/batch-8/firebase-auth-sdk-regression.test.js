import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const workspacePath = (...segments) => resolve(process.cwd(), ...segments);

describe('Firebase Auth persistence regression guard', () => {
  it('pins the fixed Firebase and Auth versions', async () => {
    const manifest = await readJson(workspacePath('package.json'));
    const lockfile = await readJson(workspacePath('package-lock.json'));

    expect(manifest.dependencies.firebase).toBe('12.19.0');
    expect(lockfile.packages['node_modules/firebase'].version).toBe('12.19.0');
    expect(lockfile.packages['node_modules/firebase/node_modules/@firebase/auth'].version).toBe('1.13.6');
  });

  it('uses the reconnectable page lifecycle implementation', async () => {
    const sourceMap = await readJson(workspacePath('node_modules/firebase/firebase-auth.js.map'));
    const sourceIndex = sourceMap.sources.findIndex((path) => (
      path.endsWith('/platform_browser/persistence/indexed_db.ts')
    ));
    const source = sourceMap.sourcesContent[sourceIndex];

    expect(sourceIndex).toBeGreaterThanOrEqual(0);
    expect(source).toContain("window.addEventListener('pagehide', this.onPageHide)");
    expect(source).toContain("window.addEventListener('pageshow', this.onPageShow)");
    expect(source).not.toContain("document.addEventListener('visibilitychange'");
    expect(source).not.toContain('Database is closing/hidden');
    expect(source).not.toContain('if (this.isHiding)');
    expect(source).toContain('this.dbPromise = _openDatabase()');
  });
});
