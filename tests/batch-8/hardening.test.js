import { describe, expect, it, vi } from 'vitest';
import { StructuredLogger, stableErrorCode } from '../../functions/src/observability/StructuredLogger.js';

describe('Batch 8 production hardening', () => {
  it('emits structured privacy-safe telemetry without breaking callers', () => {
    const info = vi.fn();
    const logger = new StructuredLogger({ sink: { info }, component: 'test', environment: 'test' });
    logger.info('operation.failed', { durationMs: 12, token: 'secret', requestId: 'safe' });
    expect(info).toHaveBeenCalledWith('operation.failed', expect.objectContaining({ event: 'operation.failed', severity: 'INFO', durationMs: 12, requestId: 'safe' }));
    expect(info.mock.calls[0][1]).not.toHaveProperty('token');
    expect(() => new StructuredLogger({ sink: { info: () => { throw new Error('sink'); } }, component: 'test' }).info('x')).not.toThrow();
  });

  it('uses stable fallback error codes', () => {
    expect(stableErrorCode({ code: 'permission-denied' })).toBe('permission-denied');
    expect(stableErrorCode(new Error('no code'))).toBe('UNEXPECTED_ERROR');
  });
});
