import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { practiceQuestions } from '../../src/practice/practiceData.js';

const metadata = JSON.parse(await readFile('firebase-content/firestore/practiceQuestions.json', 'utf8'));

describe('Q250 Practice publication contract', () => {
  it('keeps canonical questions and publication metadata aligned', () => {
    expect(practiceQuestions).toHaveLength(250);
    expect(metadata).toHaveLength(250);
    expect(metadata.map(({ id }) => id)).toEqual(practiceQuestions.map(({ id }) => id));
  });
});
