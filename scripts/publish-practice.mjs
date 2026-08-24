import { performance } from 'node:perf_hooks';
import { FirebasePracticePublisher } from './publishing/FirebasePracticePublisher.mjs';
import { loadPracticeBundle } from './publishing/loadPracticeBundle.mjs';

const dryRun = process.argv.includes('--dry-run');
const startedAt = performance.now();

try {
  const bundle = await loadPracticeBundle();

  const summary = {
    status: dryRun ? 'ready-to-publish' : 'published',
    mode: dryRun ? 'dry-run' : 'publish',
    projectId: bundle.projectId,
    storageBucket: bundle.bucket,
    firestore: {
      collection: bundle.collection,
      documents: bundle.metadata.length,
      first: `${bundle.collection}/${bundle.metadata[0].id}`,
      last: `${bundle.collection}/${bundle.metadata.at(-1).id}`,
    },
    activation: {
      publication: bundle.publicationPath,
      version: bundle.version,
      protocol: ['upload', 'verify-sha256', 'ready', 'activate'],
    },
    storage: {
      objects: bundle.files.length,
      first: bundle.files[0].remotePath,
      last: bundle.files.at(-1).remotePath,
    },
    positions: { first: bundle.files[0].id, last: bundle.files.at(-1).id },
    protectedContent: 'excluded',
  };

  if (!dryRun) {
    const publisher = new FirebasePracticePublisher();
    await publisher.validateCredentials(bundle);
    summary.result = await publisher.publish(bundle, ({ stage, status, path }) => {
      if (status === 'complete') console.log(`[${stage}] ${path}`);
    });
  }

  summary.elapsedMs = Math.round(performance.now() - startedAt);
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error('Firebase Practice publishing failed:', error.message);
  if (error.cause) console.error('Cause:', error.cause.message);
  process.exitCode = 1;
}
