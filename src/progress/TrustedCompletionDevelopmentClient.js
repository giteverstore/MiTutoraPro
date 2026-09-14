import { authService } from '../auth/AuthService';

export class TrustedCompletionDevelopmentClient {
  async recordLessonCompletion(courseId, courseVersion, lessonId) {
    const idToken = await authService.getIdToken();
    if (!idToken) throw Object.assign(new Error('Sign in with the local emulator first.'), { code: 'development/unauthenticated' });
    const response = await fetch('/api/dev/courses/trusted-complete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, courseVersion, lessonId }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error(body?.error?.message || 'Trusted completion was rejected.'), { code: body?.error?.code || 'development/internal' });
    return body;
  }
}

export const trustedCompletionDevelopmentClient = new TrustedCompletionDevelopmentClient();
