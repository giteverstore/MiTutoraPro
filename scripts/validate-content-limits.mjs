import { loadAndValidateCourseBundle } from './publishing/loadCourseBundle.mjs';
import { loadPracticeBundle } from './publishing/loadPracticeBundle.mjs';

const results = [];
for (const courseId of ['python', 'java']) {
  const bundle = await loadAndValidateCourseBundle(courseId);
  results.push(`${courseId}: ${bundle.metrics.modules} modules, ${bundle.metrics.lessons} lessons`);
}
const practice = await loadPracticeBundle();
results.push(`practice: ${practice.metadata.length} questions`);
console.log(`Content complexity limits passed.\n${results.join('\n')}`);
