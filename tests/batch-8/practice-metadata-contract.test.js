import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createPracticeMetadata } from '../../src/content/models/practiceMetadata.js';
import { practiceQuestions } from '../../src/practice/practiceData.js';
import { validatePracticeMetadataRecord } from '../../scripts/publishing/validatePracticeMetadata.mjs';

const repairedIds = [
  'practice-even-or-odd',
  'practice-sum-range',
  'practice-reverse-text',
  'practice-largest-number',
  'practice-word-frequency',
  'practice-palindrome',
];

const metadata = JSON.parse(await readFile('firebase-content/firestore/practiceQuestions.json', 'utf8'));

describe('Practice metadata publication contract', () => {
  it('validates all 200 canonical questions and generated metadata records', () => {
    expect(practiceQuestions).toHaveLength(200);
    expect(metadata).toHaveLength(200);
    metadata.forEach((record) => expect(() => validatePracticeMetadataRecord(record)).not.toThrow());
  });

  it('repairs every legacy question with taxonomy and skills metadata', () => {
    for (const id of repairedIds) {
      const question = practiceQuestions.find((item) => item.id === id);
      expect(question).toMatchObject({ id, category: 'fundamentals', questionType: 'implementation' });
      expect(question.subtopic).toBeTruthy();
      expect(question.skills.length).toBeGreaterThan(0);
    }
  });

  it('normalizes the catalog page spanning positions 21 through 26', () => {
    const page = metadata.filter(({ position }) => position >= 21 && position <= 26).map(createPracticeMetadata);
    expect(page.map(({ id }) => id)).toEqual(repairedIds);
  });

  it.each([
    ['category', undefined],
    ['subtopic', undefined],
    ['questionType', undefined],
    ['skills', 'not-an-array'],
  ])('rejects invalid required %s before publication activation', (field, value) => {
    const invalid = { ...metadata[0], [field]: value };
    expect(() => validatePracticeMetadataRecord(invalid)).toThrow('Practice metadata is invalid');
    expect(() => createPracticeMetadata(invalid)).toThrowError(expect.objectContaining({ code: 'content/invalid-metadata' }));
  });

  it('does not expose protected or reference content in generated learner artifacts', async () => {
    const texts = await Promise.all(metadata.map(({ position, version }) => (
      readFile(`firebase-content/practice/python/${version}/question-${position}.json`, 'utf8')
    )));
    expect(texts.some((text) => text.includes('protectedTests') || text.includes('referenceImplementations'))).toBe(false);
  });
});
