import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { practiceQuestions } from '../../src/practice/practiceData.js';

const listArtifacts = (path) => readdir(path, { recursive: true }).catch((error) => {
  if (error.code === 'ENOENT') return [];
  throw error;
});

describe('Q250 Practice bank', () => {
  it('exposes the complete bundled catalog without the legacy empty-bank gate', async () => {
    expect(practiceQuestions).toHaveLength(250);
    const source = await readFile('src/practice/practiceContentSource.js', 'utf8');
    expect(source).toContain('export const PRACTICE_BANK_EMPTY = false;');
    expect(source).toContain('PRACTICE_CONTENT_SOURCES.LOCAL');
  });

  it('loads Daily Challenge assignments from their published metadata authority', async () => {
    const source = await readFile('src/challenges/challengeContentSource.js', 'utf8');
    expect(source).not.toContain('CHALLENGE_BANK_EMPTY');
    expect(source).toContain('const contentSource = createChallengeContentSource();');
  });

  it('contains 250 generated Practice artifacts while Daily Challenges remain empty', async () => {
    const practiceArtifacts = await listArtifacts('firebase-content/practice');
    const challengeArtifacts = await listArtifacts('firebase-content/daily-challenges');
    expect(practiceArtifacts.filter((entry) => entry.endsWith('.json'))).toHaveLength(250);
    expect(challengeArtifacts.filter((entry) => entry.endsWith('.json'))).toEqual([]);
    await expect(readFile('firebase-content/firestore/practiceQuestions.json', 'utf8').then(JSON.parse)).resolves.toHaveLength(250);
    await expect(readFile('firebase-content/firestore/dailyChallenges.json', 'utf8').then(JSON.parse)).resolves.toEqual([]);
  });
});
