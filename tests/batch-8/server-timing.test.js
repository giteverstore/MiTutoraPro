import { describe, expect, it, vi } from 'vitest';
import { createServerTiming } from '../../server/http/serverTiming.js';

describe('server timing utility', () => {
  it('emits approved numeric durations and total without descriptions', () => {
    let value = 10;
    const timing = createServerTiming({ now: () => value });
    const finish = timing.start('auth');
    value = 22.34;
    finish();
    value = 31.11;
    const response = { setHeader: vi.fn() };

    timing.apply(response);

    expect(response.setHeader).toHaveBeenCalledWith('Server-Timing', 'auth;dur=12.3, total;dur=21.1');
    expect(response.setHeader.mock.calls[0][1]).not.toContain('desc=');
  });

  it('rejects unapproved and dynamic metric names', () => {
    const timing = createServerTiming();
    expect(() => timing.start('user-abc123')).toThrow(TypeError);
    expect(() => timing.start('/private/document/path')).toThrow(TypeError);
  });

  it('preserves existing timing and unrelated response headers', () => {
    const response = {
      headers: { 'Cache-Control': 'no-store', 'Server-Timing': 'proxy;dur=2.0' },
      getHeader(name) { return this.headers[name]; },
      setHeader(name, value) { this.headers[name] = value; },
    };
    const timing = createServerTiming({ now: () => 5 });
    timing.apply(response, { include: ['total'] });
    expect(response.headers['Server-Timing']).toBe('proxy;dur=2.0, total;dur=0.0');
    expect(response.headers['Cache-Control']).toBe('no-store');
  });
});
