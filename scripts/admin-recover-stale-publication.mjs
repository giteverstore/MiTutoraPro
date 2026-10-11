import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FirebaseContentPublicationStore } from '../server/admin/content/FirebaseContentPublicationStore.js';

// This one-shot entry point is deliberately pinned to the single historical incident.
const CONTENT_ID = 'course-1791616150410';
const EXPECTED_REVISION = 5;
const EXPECTED_VERSION = 1;
const EXPECTED_ACTIVE_REVISION = 0;
const PROJECT_ID = 'mi-tutora-pro';
const CONFIRMATION = `${CONTENT_ID}:rev${EXPECTED_REVISION}:v${EXPECTED_VERSION}`;

if (process.argv.slice(2).join(' ') !== `--execute ${CONFIRMATION}`
  || process.env.FIREBASE_PROJECT_ID !== PROJECT_ID
  || process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(`Not executed. Requires FIREBASE_PROJECT_ID=${PROJECT_ID} and --execute ${CONFIRMATION}; Firestore emulator must be disabled.`);
  process.exitCode = 1;
} else {
  let app;
  try {
    app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID }, 'ycoders-stale-publication-recovery');
    const store = new FirebaseContentPublicationStore(getFirestore(app));
    const result = await store.recoverStaleFailedPublication({
      contentId: CONTENT_ID,
      expectedRevision: EXPECTED_REVISION,
      expectedVersion: EXPECTED_VERSION,
      expectedActiveRevision: EXPECTED_ACTIVE_REVISION,
    });
    console.log(`Recovered ${result.contentId} revision ${result.draftRevision} to ${result.lifecycleState}.`);
  } catch (error) {
    console.error(`Recovery stopped: ${error?.code === 'content/stale-publication-recovery-precondition' ? 'guarded preconditions did not match' : 'operation failed'}.`);
    process.exitCode = 1;
  } finally {
    if (app) await deleteApp(app);
  }
}
