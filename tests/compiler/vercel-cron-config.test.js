import { describe, expect, it } from 'vitest';
import { CRON_SCHEDULES, createVercelConfig } from '../../vercel.mjs';

describe('Vercel project cron isolation', () => {
  it('keeps the existing main-site schedules by default', () => {
    expect(createVercelConfig().crons).toEqual([
      CRON_SCHEDULES.payments,
      CRON_SCHEDULES.shares,
    ]);
  });

  it('schedules only standalone share cleanup for the compiler project', () => {
    expect(createVercelConfig('compiler').crons).toEqual([CRON_SCHEDULES.shares]);
  });

  it('fails closed for a mistyped deployment target', () => {
    expect(() => createVercelConfig('compielr')).toThrow('Unsupported YCODERS_DEPLOYMENT_TARGET');
  });

  it('keeps every launch cron at no more than one run per day', () => {
    for (const target of ['main', 'compiler']) {
      const config = createVercelConfig(target);
      expect(config.crons.every(({ schedule }) => /^\d+ \d+ \* \* \*$/.test(schedule))).toBe(true);
      expect(config.crons.some(({ path }) => path === '/api/compiler/mysql/janitor')).toBe(false);
    }
  });

  it('preserves filesystem-first SPA routing and API exclusions', () => {
    const config = createVercelConfig('compiler');
    expect(config.routes[0]).toEqual({ handle: 'filesystem' });
    expect(config.routes[1]).toEqual(expect.objectContaining({ dest: '/index.html' }));
    expect(config.routes[1].src).toContain('api');
  });
});
