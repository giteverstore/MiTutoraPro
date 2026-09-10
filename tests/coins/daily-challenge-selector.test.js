import { describe, expect, it } from 'vitest';
import { selectLatestPublishedChallenge } from '../../src/challenges/challengeContentSource.js';

describe('Daily Challenge selector', () => {
  it('selects the latest published metadata record without requiring today\'s explicit date', () => {
    expect(selectLatestPublishedChallenge([
      { id: 'older', date: '2026-07-31' },
      { id: 'canonical', date: '2026-08-01' },
    ])).toEqual({ id: 'canonical', date: '2026-08-01' });
  });

  it('returns null for an empty catalog', () => {
    expect(selectLatestPublishedChallenge([])).toBeNull();
  });
});
