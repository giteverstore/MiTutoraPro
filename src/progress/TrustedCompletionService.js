import { callFirebaseFunction } from '../firebase/functions';

export class TrustedCompletionService {
  constructor() { this.sessions = new Map(); }

  sessionKey(courseId, courseVersion, lessonId) { return `${courseId}:${courseVersion}:${lessonId}`; }

  beginLessonEvidence(courseId, courseVersion, lessonId) {
    const key = this.sessionKey(courseId, courseVersion, lessonId);
    if (!this.sessions.has(key)) {
      const request = callFirebaseFunction('beginTrustedLessonEvidence', { courseId, courseVersion, lessonId })
        .catch((error) => { this.sessions.delete(key); throw error; });
      this.sessions.set(key, request);
    }
    return this.sessions.get(key);
  }

  async recordLessonCompletion(courseId, courseVersion, lessonId, evidencePayload = {}) {
    const key = this.sessionKey(courseId, courseVersion, lessonId);
    const session = await (this.sessions.get(key) ?? this.beginLessonEvidence(courseId, courseVersion, lessonId));
    try {
      return await callFirebaseFunction('recordTrustedLessonCompletion', {
        courseId,
        courseVersion,
        lessonId,
        evidence: { ...evidencePayload, sessionId: session.sessionId, challenge: session.challenge },
      });
    } catch (error) {
      if (['functions/deadline-exceeded', 'functions/not-found'].includes(error?.code)) this.sessions.delete(key);
      throw error;
    }
  }
}

export const trustedCompletionService = new TrustedCompletionService();
