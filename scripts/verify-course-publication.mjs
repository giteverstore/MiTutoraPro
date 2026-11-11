import { createHash } from 'node:crypto';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { loadEnv } from 'vite';
import { loadAndValidateCourseBundle } from './publishing/loadCourseBundle.mjs';

const courseKeys = process.argv.slice(2);
if (!courseKeys.length) throw new Error('Provide one or more course keys.');

const environment = { ...loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), ''), ...process.env };
const projectId = environment.FIREBASE_PROJECT_ID ?? environment.VITE_FIREBASE_PROJECT_ID;
const storageBucket = environment.FIREBASE_STORAGE_BUCKET ?? environment.VITE_FIREBASE_STORAGE_BUCKET;
if (!projectId || !storageBucket) throw new Error('FIREBASE_PROJECT_ID and FIREBASE_STORAGE_BUCKET are required.');
if (environment.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = environment.GOOGLE_APPLICATION_CREDENTIALS;
}
const credential = environment.FIREBASE_SERVICE_ACCOUNT_JSON
  ? cert(JSON.parse(environment.FIREBASE_SERVICE_ACCOUNT_JSON))
  : applicationDefault();
const app = getApps().find(({ name }) => name === 'mitutora-content-publication-verifier')
  ?? initializeApp({ credential, projectId, storageBucket }, 'mitutora-content-publication-verifier');
await app.options.credential.getAccessToken();
const db = getFirestore(app);
const bucket = getStorage(app).bucket();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const results = [];
for (const courseKey of courseKeys) {
  const bundle = await loadAndValidateCourseBundle(courseKey);
  const [courseSnapshot, publicationSnapshot, versionSnapshot] = await Promise.all([
    db.collection('courses').doc(bundle.metadata.id).get(),
    db.collection('contentPublications').doc(`course-${bundle.metadata.id}`).get(),
    db.collection('contentPublications').doc(`course-${bundle.metadata.id}`).collection('versions').doc(bundle.metadata.version).get(),
  ]);
  const artifacts = [];
  for (const file of bundle.files) {
    const remote = bucket.file(file.remotePath);
    const [exists] = await remote.exists();
    let remoteHash = null;
    if (exists) remoteHash = sha256((await remote.download())[0]);
    artifacts.push({
      path: file.remotePath,
      exists,
      localSha256: file.sha256,
      remoteSha256: remoteHash,
      matches: exists ? remoteHash === file.sha256 : null,
    });
  }
  results.push({
    courseId: bundle.metadata.id,
    requestedVersion: bundle.metadata.version,
    projectId,
    storageBucket: bucket.name,
    courseDocument: courseSnapshot.exists ? courseSnapshot.data() : null,
    publication: publicationSnapshot.exists ? publicationSnapshot.data() : null,
    versionRecord: versionSnapshot.exists ? versionSnapshot.data() : null,
    artifacts,
  });
}

console.log(JSON.stringify(results, null, 2));
