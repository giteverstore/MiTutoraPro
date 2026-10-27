import { authenticatedJsonPost } from '../api/authenticatedJsonRequest';
import { authService } from '../auth/AuthService';

export class TrustedCompletionDevelopmentClient {
  constructor({ tokenProvider = () => authService.getIdToken(), fetchImpl = (...args) => globalThis.fetch(...args) } = {}) {
    this.tokenProvider = tokenProvider;
    this.fetchImpl = fetchImpl;
  }

  async recordLessonCompletion(courseId, courseVersion, lessonId) {
    const result = await authenticatedJsonPost({ tokenProvider: this.tokenProvider, fetchImpl: this.fetchImpl, url: '/api/dev/courses/trusted-complete', body: { courseId, courseVersion, lessonId } });
    if (!result) throw Object.assign(new Error('Sign in with the local emulator first.'), { code: 'development/unauthenticated' });
    const { response, payload: body } = result;
    if (!response.ok) throw Object.assign(new Error(body?.error?.message || 'Trusted completion was rejected.'), { code: body?.error?.code || 'development/internal' });
    return body;
  }
}

export const trustedCompletionDevelopmentClient = new TrustedCompletionDevelopmentClient();
