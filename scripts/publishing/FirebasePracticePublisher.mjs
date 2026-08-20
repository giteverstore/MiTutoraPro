import { createHash } from 'node:crypto';
import { FirebaseCoursePublisher } from './FirebaseCoursePublisher.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export class FirebasePracticePublisher {
  constructor() {
    const firebaseClient = new FirebaseCoursePublisher();
    this.app = firebaseClient.app;
    this.db = firebaseClient.db;
    this.bucket = firebaseClient.bucket;
  }

  async validateCredentials(bundle) {
    if (this.app.options.projectId !== bundle.projectId) {
      throw new Error(`Refusing to publish Practice content to unexpected project ${this.app.options.projectId}.`);
    }
    if (this.bucket.name !== bundle.bucket) {
      throw new Error(`Refusing to publish Practice content to unexpected bucket ${this.bucket.name}.`);
    }
    await this.app.options.credential.getAccessToken();
  }

  async publish(bundle, onProgress = () => {}) {
    await this.validateCredentials(bundle);

    for (const file of bundle.files) {
      const remoteFile = this.bucket.file(file.remotePath);
      const [exists] = await remoteFile.exists();
      if (!exists) continue;
      const [remoteBytes] = await remoteFile.download();
      if (sha256(remoteBytes) !== file.sha256) {
        throw new Error(`Published Practice content is immutable: ${file.remotePath} differs from local v1. Publish a new version instead.`);
      }
    }

    for (const file of bundle.files) {
      onProgress({ stage: 'upload', path: file.remotePath, status: 'running' });
      await this.bucket.upload(file.localPath, {
        destination: file.remotePath,
        resumable: false,
        metadata: {
          contentType: 'application/json; charset=utf-8',
          cacheControl: 'public, max-age=31536000, immutable',
          metadata: { contentType: 'practice-question', questionId: file.id, version: 'v1' },
        },
      });
      onProgress({ stage: 'upload', path: file.remotePath, status: 'complete' });
    }

    const batch = this.db.batch();
    for (const record of bundle.metadata) {
      batch.set(this.db.collection(bundle.collection).doc(record.id), record);
    }
    await batch.commit();
    onProgress({ stage: 'metadata', path: `${bundle.collection}/*`, status: 'complete' });

    for (const file of bundle.files) {
      const remoteFile = this.bucket.file(file.remotePath);
      const [[exists], [remoteMetadata]] = await Promise.all([remoteFile.exists(), remoteFile.getMetadata()]);
      if (!exists || Number(remoteMetadata.size) !== file.size) {
        throw new Error(`Upload verification failed for ${file.remotePath}.`);
      }
    }

    const snapshots = await Promise.all(bundle.metadata.map(({ id }) => this.db.collection(bundle.collection).doc(id).get()));
    if (snapshots.some((snapshot, index) => !snapshot.exists || snapshot.id !== bundle.metadata[index].id)) {
      throw new Error('Firestore Practice metadata verification failed.');
    }

    return { uploaded: bundle.files.length, metadataDocuments: snapshots.length };
  }
}
