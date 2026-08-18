import { applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { loadEnv } from 'vite';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function loadPublisherEnvironment() {
  const fileEnvironment = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
  return { ...fileEnvironment, ...process.env };
}

function createCredential(environment) {
  if (!environment.FIREBASE_SERVICE_ACCOUNT_JSON) return applicationDefault();
  try {
    return cert(JSON.parse(environment.FIREBASE_SERVICE_ACCOUNT_JSON));
  } catch (error) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.', { cause: error });
  }
}

function initializePublisherApp() {
  const environment = loadPublisherEnvironment();
  const projectId = environment.FIREBASE_PROJECT_ID ?? environment.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = environment.FIREBASE_STORAGE_BUCKET ?? environment.VITE_FIREBASE_STORAGE_BUCKET;
  if (!projectId || !storageBucket) {
    throw new Error('FIREBASE_PROJECT_ID and FIREBASE_STORAGE_BUCKET are required for publishing.');
  }
  if (environment.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = environment.GOOGLE_APPLICATION_CREDENTIALS;
  }
  const name = 'mitutora-content-publisher';
  const existing = getApps().find((app) => app.name === name);
  return existing ?? initializeApp({ credential: createCredential(environment), projectId, storageBucket }, name);
}

export class FirebaseCoursePublisher {
  constructor() {
    this.app = initializePublisherApp();
    this.db = getFirestore(this.app);
    this.bucket = getStorage(this.app).bucket();
  }

  async publish(bundle, onProgress = () => {}) {
    onProgress({ stage: 'credentials', path: this.app.options.projectId, status: 'running' });
    try {
      await this.app.options.credential.getAccessToken();
    } catch (error) {
      throw new Error(
        'Firebase Admin credentials are unavailable. Configure GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON.',
        { cause: error },
      );
    }
    onProgress({ stage: 'credentials', path: this.app.options.projectId, status: 'complete' });

    for (const file of bundle.files) {
      const remoteFile = this.bucket.file(file.remotePath);
      const [exists] = await remoteFile.exists();
      if (!exists) continue;
      const [localBytes, [remoteBytes]] = await Promise.all([
        readFile(file.localPath),
        remoteFile.download(),
      ]);
      if (sha256(localBytes) !== sha256(remoteBytes)) {
        throw new Error(
          `Published content is immutable: ${file.remotePath} already exists with different bytes. Bump the course version before publishing.`,
        );
      }
    }

    const uploaded = [];
    for (const file of bundle.files) {
      onProgress({ stage: 'upload', path: file.remotePath, status: 'running' });
      await this.bucket.upload(file.localPath, {
        destination: file.remotePath,
        resumable: false,
        metadata: {
          contentType: 'application/json; charset=utf-8',
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: { courseId: bundle.metadata.id, version: bundle.metadata.version },
        },
      });
      uploaded.push(file.remotePath);
      onProgress({ stage: 'upload', path: file.remotePath, status: 'complete' });
    }

    const document = this.db.collection('courses').doc(bundle.metadata.id);
    onProgress({ stage: 'metadata', path: document.path, status: 'running' });
    await document.set(bundle.metadata);
    onProgress({ stage: 'metadata', path: document.path, status: 'complete' });

    const verified = [];
    for (const file of bundle.files) {
      const remoteFile = this.bucket.file(file.remotePath);
      const [exists] = await remoteFile.exists();
      if (!exists) throw new Error(`Upload verification failed: ${file.remotePath} does not exist.`);
      const [remoteMetadata] = await remoteFile.getMetadata();
      if (Number(remoteMetadata.size) !== file.size) {
        throw new Error(`Upload verification failed: ${file.remotePath} has an unexpected size.`);
      }
      verified.push(file.remotePath);
      onProgress({ stage: 'verify', path: file.remotePath, status: 'complete' });
    }

    const snapshot = await document.get();
    const remoteDocument = snapshot.data();
    const metadataMatches = snapshot.exists && Object.entries(bundle.metadata)
      .every(([field, value]) => JSON.stringify(remoteDocument?.[field]) === JSON.stringify(value));
    if (!metadataMatches) {
      throw new Error(`Firestore verification failed for ${document.path}.`);
    }
    onProgress({ stage: 'verify', path: document.path, status: 'complete' });
    return { uploaded, verified, metadataDocument: document.path };
  }
}
