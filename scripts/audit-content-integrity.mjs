import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifests = [
  ['practice', 'firebase-content/firestore/practiceQuestions.json'],
  ['courses', 'firebase-content/firestore/courses.json'],
  ['challenges', 'firebase-content/firestore/dailyChallenges.json'],
];

const report = [];
for (const [kind, file] of manifests) {
  try {
    const records = JSON.parse(await readFile(resolve(file), 'utf8'));
    const items = Array.isArray(records) ? records : Object.values(records);
    report.push({ kind, records: items.length, withHash: items.filter((item) => item.contentHash || item.manifestHash).length });
  } catch (error) {
    report.push({ kind, records: 0, withHash: 0, error: error.code ?? 'INVALID_ARTIFACT' });
  }
}
console.log(JSON.stringify({ mode: 'DRY_RUN', mutationCount: 0, algorithm: 'sha256', report, emptyHash: sha256(Buffer.alloc(0)) }, null, 2));
