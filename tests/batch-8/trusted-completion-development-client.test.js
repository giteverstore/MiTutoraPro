import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/auth/AuthService', () => ({ authService: { getIdToken: vi.fn() } }));

import { TrustedCompletionDevelopmentClient } from '../../src/progress/TrustedCompletionDevelopmentClient.js';

describe('TrustedCompletionDevelopmentClient authenticated transport', () => {
  it('sends the authenticated trusted-completion request and returns its payload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ eligibilityStatus: 'ELIGIBLE' }),
    });
    const client = new TrustedCompletionDevelopmentClient({
      tokenProvider: async () => 'development-token',
      fetchImpl,
    });

    await expect(client.recordLessonCompletion('python', 'v1', 'lesson-2'))
      .resolves.toEqual({ eligibilityStatus: 'ELIGIBLE' });
    expect(fetchImpl).toHaveBeenCalledWith('/api/dev/courses/trusted-complete', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer development-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ courseId: 'python', courseVersion: 'v1', lessonId: 'lesson-2' }),
    });
  });

  it('preserves the missing-auth domain code and suppresses fetch', async () => {
    const fetchImpl = vi.fn();
    const client = new TrustedCompletionDevelopmentClient({
      tokenProvider: async () => null,
      fetchImpl,
    });

    await expect(client.recordLessonCompletion('python', 'v1', 'lesson-2'))
      .rejects.toMatchObject({
        message: 'Sign in with the local emulator first.',
        code: 'development/unauthenticated',
      });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('preserves server error messages and domain codes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Completion is unavailable.', code: 'development/course-unavailable' } }),
    });
    const client = new TrustedCompletionDevelopmentClient({
      tokenProvider: async () => 'development-token',
      fetchImpl,
    });

    await expect(client.recordLessonCompletion('python', 'v1', 'lesson-2'))
      .rejects.toMatchObject({
        message: 'Completion is unavailable.',
        code: 'development/course-unavailable',
      });
  });
});
