import { CanonicalTutorContentSource } from './CanonicalTutorContentSource.js';
import { createFirebaseTutorContentSource } from './FirebaseTutorContentSource.js';
import { AIServiceError } from '../AIServiceError.js';
import { reportTutorContentFailure } from './tutorContentDiagnostics.js';

export class CompositeTutorContentSource {
  constructor({ canonical = new CanonicalTutorContentSource(), fallbackFactory = createFirebaseTutorContentSource, failureLogger = console.error } = {}) {
    this.canonical = canonical;
    this.fallbackFactory = fallbackFactory;
    this.failureLogger = failureLogger;
  }

  async get(options) {
    try {
      return await this.canonical.get(options);
    } catch (error) {
      if (error?.contentSourceFailure !== 'not-published' || options.contentVersion != null || !['course', 'practice'].includes(options.surface)) throw error;
      reportTutorContentFailure(this.failureLogger, { reason: 'canonical-miss', surface: options.surface, source: 'admin' });
    }
    let session;
    try {
      session = await this.fallbackFactory({ environment: options.environment, credentials: options.credentials });
      return await session.source.get(options);
    } catch (error) {
      reportTutorContentFailure(this.failureLogger, {
        reason: error?.tutorContentFailureReason,
        surface: options.surface,
        source: options.surface === 'course' ? 'legacy-course' : 'firebase-practice',
      });
      if (error instanceof AIServiceError) throw error;
      throw new AIServiceError('ai/content-unavailable', 'The requested learning content is unavailable.', { status: 503, cause: error });
    } finally {
      try { await session?.close(); } catch { /* Request cleanup must not replace the resolution result. */ }
    }
  }
}
