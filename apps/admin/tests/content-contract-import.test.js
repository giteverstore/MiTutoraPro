import { describe, expect, it } from 'vitest';
import { CONTENT_TYPES, normalizeLegacyDomainContent, validateSchema } from '../../../shared/content/index.js';

describe('Admin shared content-contract boundary', () => {
  it('imports the canonical schemas without learner application state', () => {
    expect(validateSchema({ blockId: 'admin-preview', type: 'paragraph', text: 'Contract preview.' }, 'block').valid).toBe(true);
    const course = normalizeLegacyDomainContent({ contentId: 'course-fixture', contentType: 'course', content: { title: 'Existing course payload' } });
    expect(course.contentType).toBe(CONTENT_TYPES.COURSE);
  });
});
