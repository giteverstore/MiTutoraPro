import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

async function functionEntrypoints(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return functionEntrypoints(absolute);
    return entry.isFile() && entry.name.endsWith('.js') ? [path.relative(process.cwd(), absolute).replaceAll('\\', '/')] : [];
  }));
  return nested.flat().sort();
}

describe('Vercel Hobby function budget', () => {
  it('keeps file-based API entrypoints at or below the guarded limit', async () => {
    const entrypoints = await functionEntrypoints(path.join(process.cwd(), 'api'));
    expect(entrypoints).toHaveLength(8);
    expect(entrypoints).toContain('api/compiler/[...path].js');
    expect(entrypoints.filter((entry) => entry.startsWith('api/compiler/'))).toEqual(['api/compiler/[...path].js']);
    expect(entrypoints.filter((entry) => entry.startsWith('api/payments/'))).toEqual(['api/payments/[...path].js']);
    expect(entrypoints.length).toBeLessThanOrEqual(10);
  });
});
