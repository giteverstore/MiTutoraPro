import { performance } from 'node:perf_hooks';
import { FirebaseCoursePublisher } from './publishing/FirebaseCoursePublisher.mjs';
import { loadAndValidateCourseBundle } from './publishing/loadCourseBundle.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const courseKey = args.find((argument) => !argument.startsWith('--'));
const startedAt = performance.now();
const summary = {
  course: courseKey ?? null,
  mode: dryRun ? 'validation-only' : 'publish',
  validation: 'pending',
  uploads: [],
  verification: [],
  metadata: null,
  credentials: 'not-checked',
};

try {
  const bundle = await loadAndValidateCourseBundle(courseKey);
  summary.validation = 'passed';
  summary.version = bundle.metadata.version;
  summary.metadataTarget = `courses/${bundle.metadata.id}`;
  summary.metrics = bundle.metrics;
  summary.files = bundle.files.length;

  if (!dryRun) {
    const publisher = new FirebaseCoursePublisher();
    const result = await publisher.publish(bundle, ({ stage, path, status }) => {
      if (status === 'complete') {
        if (stage === 'credentials') summary.credentials = 'verified';
        if (stage === 'upload') summary.uploads.push(path);
        if (stage === 'verify') summary.verification.push(path);
        if (stage === 'metadata') summary.metadata = path;
      }
      console.log(`[${stage}] ${status}: ${path}`);
    });
    summary.metadata = result.metadataDocument;
  }

  summary.status = dryRun ? 'ready-to-publish' : 'published';
  summary.elapsedMs = Math.round(performance.now() - startedAt);
  console.log('\nFirebase course publishing summary');
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  summary.status = 'failed';
  summary.elapsedMs = Math.round(performance.now() - startedAt);
  summary.error = error.message;
  console.error('\nFirebase course publishing failed');
  console.error(JSON.stringify(summary, null, 2));
  if (error.cause) console.error('Cause:', error.cause.message);
  process.exitCode = 1;
}
