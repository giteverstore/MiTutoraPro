import { describe, expect, it } from 'vitest';
import { AIServiceError } from '../../server/ai/AIServiceError.js';
import { publicActivityError } from '../../server/coins/activityCompletionHandler.js';

describe('activity completion HTTP errors', () => {
  it.each(['ai/auth-required', 'ai/auth-invalid'])('maps %s to the finite coin authentication error', (code) => {
    expect(publicActivityError(new AIServiceError(code, 'internal auth detail', { status: 401 }))).toEqual({
      status: 401,
      body: { error: { code: 'coin/unauthenticated', message: 'Sign in to save this completion.' } },
    });
  });

  it('keeps unexpected failures sanitized', () => {
    expect(publicActivityError(new Error('private internal detail'))).toEqual({
      status: 503,
      body: { error: { code: 'coin/service-unavailable', message: 'Activity completion could not be recorded.' } },
    });
  });
});
