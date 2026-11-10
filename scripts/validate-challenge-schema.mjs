import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const metadata = JSON.parse(await readFile('firebase-content/firestore/dailyChallenges.json', 'utf8'));
const source = await readFile('src/challenges/challengeContentSource.js', 'utf8');
assert.match(source, /export const CHALLENGE_BANK_EMPTY = true;/);
assert.match(source, /listMetadata: async \(\) => \[\]/);
assert.deepEqual(metadata, []);

console.log('Valid empty Daily Challenge bank and preserved content-source infrastructure.');
