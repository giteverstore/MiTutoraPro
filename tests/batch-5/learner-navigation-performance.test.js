import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanonicalPublishedRepository } from '../../src/content/repositories/CanonicalPublishedRepository.js';

afterEach(() => vi.restoreAllMocks());

describe('immutable published-content session reads', () => {
  it('deduplicates exact versions across repository instances while refreshing ACTIVE', async () => {
    const fetch = vi.spyOn(CanonicalPublishedRepository.prototype, 'fetch').mockResolvedValue({ document: { version: 7 } });
    const first = new CanonicalPublishedRepository({ contentType: 'COURSE' });
    const second = new CanonicalPublishedRepository({ contentType: 'COURSE' });
    await Promise.all([first.exact('phase5-cache-course', 7), second.exact('phase5-cache-course', 7)]);
    await second.exact('phase5-cache-course', 7);
    expect(fetch).toHaveBeenCalledTimes(1);
    await first.active('phase5-cache-course');
    await second.active('phase5-cache-course');
    expect(fetch).toHaveBeenCalledTimes(3);
    await first.exact('phase5-cache-course', 8);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('does not cache failed exact reads', async () => {
    const fetch = vi.spyOn(CanonicalPublishedRepository.prototype, 'fetch')
      .mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValue({ document: { version: 7 } });
    const repository = new CanonicalPublishedRepository({ contentType: 'COURSE' });
    await expect(repository.exact('phase5-cache-retry', 7)).rejects.toThrow('temporary failure');
    await expect(repository.exact('phase5-cache-retry', 7)).resolves.toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not share reads from injected fetchers or across content types', async () => {
    const fetch = vi.spyOn(CanonicalPublishedRepository.prototype, 'fetch').mockResolvedValue({ document: { version: 1 } });
    const custom = vi.fn();
    const injected = new CanonicalPublishedRepository({ contentType: 'COURSE', fetcher: custom });
    await injected.exact('phase5-injected', 1);
    await injected.exact('phase5-injected', 1);
    expect(fetch).toHaveBeenCalledTimes(2);

    await new CanonicalPublishedRepository({ contentType: 'COURSE' }).exact('phase5-type-isolation', 1);
    await new CanonicalPublishedRepository({ contentType: 'PRACTICE' }).exact('phase5-type-isolation', 1);
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
