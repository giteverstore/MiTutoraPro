import { readFile } from 'node:fs/promises';
import { practiceQuestions } from '../src/practice/practiceData.js';
import {
  PRACTICE_CONTENT_SOURCES,
  resolvePracticeContentSource,
} from '../src/practice/practiceContentSourceConfig.js';

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

assert(
  resolvePracticeContentSource({ isDevelopment: true, configuredSource: 'local' })
    === PRACTICE_CONTENT_SOURCES.LOCAL,
  'Development must select the canonical local Practice source when explicitly configured.',
);
assert(
  resolvePracticeContentSource({ isDevelopment: true, configuredSource: undefined })
    === PRACTICE_CONTENT_SOURCES.FIREBASE,
  'Development must remain Firebase-first when the explicit source selector is absent.',
);
assert(
  resolvePracticeContentSource({ isDevelopment: true, configuredSource: 'firebase' })
    === PRACTICE_CONTENT_SOURCES.FIREBASE,
  'Explicit Firebase selection must remain Firebase-backed.',
);
assert(
  resolvePracticeContentSource({ isDevelopment: false, configuredSource: 'local' })
    === PRACTICE_CONTENT_SOURCES.FIREBASE,
  'Production must ignore the local Practice source override.',
);
assert(practiceQuestions.length === 200, `Expected 200 canonical local questions; found ${practiceQuestions.length}.`);

const batch10Ids = Array.from({ length: 19 }, (_, index) => `fund-errors-${String(index + 1).padStart(3, '0')}`);
const localIds = practiceQuestions.map(({ id }) => id);
assert(
  JSON.stringify(localIds.slice(181)) === JSON.stringify(batch10Ids),
  'Batch 10 must be accessible at canonical catalog positions 182 through 200.',
);

const practicePageSource = await readFile(new URL('../src/practice/PracticePage.jsx', import.meta.url), 'utf8');
assert(practicePageSource.includes('practiceContentSource.listPage'), 'Practice must load paged metadata through its content source.');
assert(!practicePageSource.includes('loadPracticeQuestions('), 'Practice must not eagerly load the complete question bank.');
assert(
  !practicePageSource.includes('Mock catalog'),
  'Practice must not present a static mock-source label for canonical or Firebase content.',
);

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  developmentExplicitLocal: 'passed',
  developmentFirebaseDefault: 'passed',
  productionFirebaseEnforcement: 'passed',
  canonicalLocalQuestions: practiceQuestions.length,
  batch10Range: `${batch10Ids[0]} through ${batch10Ids.at(-1)}`,
  generatedPositions: '182 through 200',
  metadataFirstPagination: 'passed',
  catalogSourceLabel: 'accurate',
}, null, 2));
