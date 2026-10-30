import { CanonicalTutorContentSource } from './CanonicalTutorContentSource.js';
import { createFirebaseTutorContentSource } from './FirebaseTutorContentSource.js';
import { AIServiceError } from '../AIServiceError.js';

export class CompositeTutorContentSource {
  constructor({ canonical = new CanonicalTutorContentSource(), fallbackFactory = createFirebaseTutorContentSource } = {}) {
    this.canonical = canonical;
    this.fallbackFactory = fallbackFactory;
  }

  async get(options) {
    try {
      return await this.canonical.get(options);
    } catch (error) {
      if (error?.contentSourceFailure !== 'not-published' || options.contentVersion != null || !['course', 'practice'].includes(options.surface)) throw error;
    }
    let session;
    try {
      session = await this.fallbackFactory({ environment: options.environment, credentials: options.credentials });
      return await session.source.get(options);
    } catch (error) {
      if (error instanceof AIServiceError) throw error;
      throw new AIServiceError('ai/content-unavailable', 'The requested learning content is unavailable.', { status: 503, cause: error });
    } finally {
      try { await session?.close(); } catch { /* Request cleanup must not replace the resolution result. */ }
    }
  }
}
