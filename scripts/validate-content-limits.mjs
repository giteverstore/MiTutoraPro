import { loadAndValidateCourseBundle } from './publishing/loadCourseBundle.mjs';
import { loadPracticeBundle } from './publishing/loadPracticeBundle.mjs';
import { readFile } from 'node:fs/promises';

const results = [];
for (const courseId of ['python', 'java']) {
  const bundle = await loadAndValidateCourseBundle(courseId);
  results.push(`${courseId}: ${bundle.metrics.modules} modules, ${bundle.metrics.lessons} lessons`);
}
const practiceMetadata = JSON.parse(await readFile('firebase-content/firestore/practiceQuestions.json', 'utf8'));
if (practiceMetadata.length === 0) {
  results.push('practice: 0 questions');
} else {
  const practice = await loadPracticeBundle();
  results.push(`practice: ${practice.metadata.length} questions`);
}
console.log(`Content complexity limits passed.\n${results.join('\n')}`);
