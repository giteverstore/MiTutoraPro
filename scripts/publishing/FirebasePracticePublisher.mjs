import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { FirebaseCoursePublisher } from './FirebaseCoursePublisher.mjs';
import { ContentPublicationProtocol } from './ContentPublicationProtocol.mjs';
import { activateStorageArtifact, reconcileStorageArtifact } from './StorageArtifactIntegrity.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export class FirebasePracticePublisher {
  constructor() {
    const firebaseClient = new FirebaseCoursePublisher();
    this.app = firebaseClient.app;
    this.db = firebaseClient.db;
    this.bucket = firebaseClient.bucket;
  }

  async validateCredentials(bundle) {
    if (this.app.options.projectId !== bundle.projectId) throw new Error(`Refusing to publish Practice content to unexpected project ${this.app.options.projectId}.`);
    if (this.bucket.name !== bundle.bucket) throw new Error(`Refusing to publish Practice content to unexpected bucket ${this.bucket.name}.`);
    await this.app.options.credential.getAccessToken();
  }

  async verifyFiles(bundle, onProgress) {
    for (const file of bundle.files) {
      const remoteFile = this.bucket.file(file.remotePath);
      const [exists] = await remoteFile.exists();
      if (!exists) throw new Error(`Upload verification failed: ${file.remotePath} does not exist.`);
      const [remoteBytes] = await remoteFile.download();
      if (remoteBytes.byteLength !== file.size || sha256(remoteBytes) !== file.sha256) throw new Error(`Upload integrity verification failed for ${file.remotePath}.`);
      onProgress({ stage: 'verify', path: file.remotePath, status: 'complete' });
    }
    return { artifactCount: bundle.files.length, hashes: Object.fromEntries(bundle.files.map((file) => [file.remotePath, file.sha256])) };
  }

  async publish(bundle, onProgress = () => {}) {
    await this.validateCredentials(bundle);
    const publication = this.db.collection('contentPublications').doc('practice-python');
    const versionDocument = publication.collection('versions').doc(bundle.version);
    const protocol = new ContentPublicationProtocol();
    const verification = await protocol.execute({
      upload: async () => {
        for (const file of bundle.files) {
          await reconcileStorageArtifact({
            bucket: this.bucket,
            artifact: file,
            identifyingMetadata: { contentType: 'practice-question', questionId: file.id, version: bundle.version },
            mismatchMessage: `Published Practice content is immutable: ${file.remotePath} differs from local ${bundle.version}. Publish a new version instead.`,
          });
          onProgress({ stage: 'upload', path: file.remotePath, status: 'complete' });
        }
      },
      verify: () => this.verifyFiles(bundle, onProgress),
      markReady: async (result) => {
        await versionDocument.set({ version: bundle.version, status: 'READY', artifactCount: result.artifactCount, hashes: result.hashes, verifiedAt: FieldValue.serverTimestamp() });
        onProgress({ stage: 'ready', path: versionDocument.path, status: 'complete' });
      },
      activate: async () => {
        await Promise.all(bundle.files.map(async (file) => {
          await activateStorageArtifact({
            remoteFile: this.bucket.file(file.remotePath),
            artifact: file,
            identifyingMetadata: { contentType: 'practice-question', questionId: file.id, version: bundle.version },
          });
        }));
        const batch = this.db.batch();
        bundle.metadata.forEach((record) => batch.set(this.db.collection(bundle.collection).doc(record.id), record));
        batch.set(publication, {
          activeVersion: bundle.version,
          status: 'ACTIVE',
          integrityRequired: true,
          itemCount: bundle.metadata.length,
          facets: {
            difficulties: [...new Set(bundle.metadata.map(({ difficulty }) => difficulty))].sort(),
            topics: [...new Set(bundle.metadata.map(({ topic }) => topic))].sort(),
          },
          activatedAt: FieldValue.serverTimestamp(),
        });
        await batch.commit();
        onProgress({ stage: 'activate', path: publication.path, status: 'complete' });
      },
    });

    const [activeSnapshot, metadataSnapshot] = await Promise.all([
      publication.get(),
      this.db.collection(bundle.collection).where('version', '==', bundle.version).get(),
    ]);
    if (activeSnapshot.data()?.activeVersion !== bundle.version || metadataSnapshot.size !== bundle.metadata.length) throw new Error('Practice activation verification failed.');
    return { uploaded: verification.artifactCount, metadataDocuments: metadataSnapshot.size, activeVersion: bundle.version };
  }
}
