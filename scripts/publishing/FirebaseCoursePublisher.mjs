import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { loadEnv } from 'vite';
import { createHash } from 'node:crypto';
import { ContentPublicationProtocol } from './ContentPublicationProtocol.mjs';
import { activateStorageArtifact, reconcileStorageArtifact } from './StorageArtifactIntegrity.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
function loadPublisherEnvironment() { return { ...loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), ''), ...process.env }; }
function createCredential(environment) {
  if (!environment.FIREBASE_SERVICE_ACCOUNT_JSON) return applicationDefault();
  try { return cert(JSON.parse(environment.FIREBASE_SERVICE_ACCOUNT_JSON)); }
  catch (error) { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.', { cause: error }); }
}
function initializePublisherApp() {
  const environment = loadPublisherEnvironment();
  const projectId = environment.FIREBASE_PROJECT_ID ?? environment.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = environment.FIREBASE_STORAGE_BUCKET ?? environment.VITE_FIREBASE_STORAGE_BUCKET;
  if (!projectId || !storageBucket) throw new Error('FIREBASE_PROJECT_ID and FIREBASE_STORAGE_BUCKET are required for publishing.');
  if (environment.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS) process.env.GOOGLE_APPLICATION_CREDENTIALS = environment.GOOGLE_APPLICATION_CREDENTIALS;
  return getApps().find((app) => app.name === 'mitutora-content-publisher')
    ?? initializeApp({ credential: createCredential(environment), projectId, storageBucket }, 'mitutora-content-publisher');
}

export class FirebaseCoursePublisher {
  constructor() {
    this.app = initializePublisherApp();
    this.db = getFirestore(this.app);
    this.bucket = getStorage(this.app).bucket();
  }

  async publish(bundle, onProgress = () => {}) {
    try { await this.app.options.credential.getAccessToken(); }
    catch (error) { throw new Error('Firebase Admin credentials are unavailable. Configure GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON.', { cause: error }); }
    onProgress({ stage: 'credentials', path: this.app.options.projectId, status: 'complete' });

    const document = this.db.collection('courses').doc(bundle.metadata.id);
    const publication = this.db.collection('contentPublications').doc(`course-${bundle.metadata.id}`);
    const versionDocument = publication.collection('versions').doc(bundle.metadata.version);
    const protocol = new ContentPublicationProtocol();
    const verification = await protocol.execute({
      upload: async () => {
        for (const file of bundle.files) {
          await reconcileStorageArtifact({
            bucket: this.bucket,
            artifact: file,
            identifyingMetadata: { courseId: bundle.metadata.id, version: bundle.metadata.version },
            mismatchMessage: `Published content is immutable: ${file.remotePath} already exists with different bytes. Bump the course version before publishing.`,
          });
          onProgress({ stage: 'upload', path: file.remotePath, status: 'complete' });
        }
      },
      verify: async () => {
        for (const file of bundle.files) {
          const [remoteBytes] = await this.bucket.file(file.remotePath).download();
          if (remoteBytes.byteLength !== file.size || sha256(remoteBytes) !== file.sha256) throw new Error(`Upload integrity verification failed for ${file.remotePath}.`);
          onProgress({ stage: 'verify', path: file.remotePath, status: 'complete' });
        }
        return { artifactCount: bundle.files.length, hashes: Object.fromEntries(bundle.files.map((file) => [file.remotePath, file.sha256])) };
      },
      markReady: async (result) => {
        await versionDocument.set({ version: bundle.metadata.version, status: 'READY', artifactCount: result.artifactCount, hashes: result.hashes, verifiedAt: FieldValue.serverTimestamp() });
        onProgress({ stage: 'ready', path: versionDocument.path, status: 'complete' });
      },
      activate: async () => {
        await Promise.all(bundle.files.map(async (file) => {
          await activateStorageArtifact({
            remoteFile: this.bucket.file(file.remotePath),
            artifact: file,
            identifyingMetadata: { courseId: bundle.metadata.id, version: bundle.metadata.version },
          });
        }));
        const batch = this.db.batch();
        batch.set(document, bundle.metadata);
        batch.set(publication, { activeVersion: bundle.metadata.version, status: 'ACTIVE', integrityRequired: true, artifactCount: bundle.files.length, activatedAt: FieldValue.serverTimestamp() });
        await batch.commit();
        onProgress({ stage: 'activate', path: publication.path, status: 'complete' });
      },
    });
    const [courseSnapshot, publicationSnapshot] = await Promise.all([document.get(), publication.get()]);
    if (!courseSnapshot.exists || publicationSnapshot.data()?.activeVersion !== bundle.metadata.version) throw new Error(`Firestore activation verification failed for ${document.path}.`);
    return { uploaded: bundle.files.map(({ remotePath }) => remotePath), verified: Object.keys(verification.hashes), metadataDocument: document.path, activeVersion: bundle.metadata.version };
  }
}
