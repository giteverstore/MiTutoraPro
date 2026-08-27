import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const metadataMatches = (current, required) => Object.entries(required)
  .every(([key, value]) => current?.[key] === value);

const assertCanonicalBytes = (remoteBytes, canonicalBytes, artifact, mismatchMessage) => {
  if (remoteBytes.byteLength !== canonicalBytes.byteLength
    || !Buffer.from(remoteBytes).equals(Buffer.from(canonicalBytes))
    || sha256(remoteBytes) !== artifact.sha256) {
    throw new Error(mismatchMessage);
  }
};

const verifyCustomMetadata = async (remoteFile, requiredMetadata) => {
  const [metadata] = await remoteFile.getMetadata();
  if (!metadataMatches(metadata.metadata, requiredMetadata)) {
    throw new Error(`Storage metadata verification failed for ${remoteFile.name}.`);
  }
  return metadata;
};

export async function reconcileStorageArtifact({
  bucket,
  artifact,
  identifyingMetadata,
  mismatchMessage,
}) {
  const canonicalBytes = await readFile(artifact.localPath);
  if (canonicalBytes.byteLength !== artifact.size || sha256(canonicalBytes) !== artifact.sha256) {
    throw new Error(`Local artifact integrity verification failed for ${artifact.remotePath}.`);
  }

  const remoteFile = bucket.file(artifact.remotePath);
  const [exists] = await remoteFile.exists();
  const requiredMetadata = {
    ...identifyingMetadata,
    sha256: artifact.sha256,
    publicationState: 'INACTIVE',
  };

  if (!exists) {
    await bucket.upload(artifact.localPath, {
      destination: artifact.remotePath,
      resumable: false,
      metadata: {
        contentType: 'application/json; charset=utf-8',
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: requiredMetadata,
      },
    });
  } else {
    const [remoteBytes] = await remoteFile.download();
    assertCanonicalBytes(remoteBytes, canonicalBytes, artifact, mismatchMessage);
    const [current] = await remoteFile.getMetadata();
    const existingState = current.metadata?.publicationState;
    const reconciledMetadata = {
      ...requiredMetadata,
      publicationState: existingState ?? 'INACTIVE',
    };
    if (!metadataMatches(current.metadata, reconciledMetadata)) {
      await remoteFile.setMetadata({ metadata: { ...current.metadata, ...reconciledMetadata } });
    }
    requiredMetadata.publicationState = reconciledMetadata.publicationState;
  }

  const [remoteBytes] = await remoteFile.download();
  assertCanonicalBytes(remoteBytes, canonicalBytes, artifact, mismatchMessage);
  await verifyCustomMetadata(remoteFile, requiredMetadata);
}

export async function activateStorageArtifact({ remoteFile, artifact, identifyingMetadata }) {
  const canonicalBytes = await readFile(artifact.localPath);
  const [remoteBytes] = await remoteFile.download();
  assertCanonicalBytes(
    remoteBytes,
    canonicalBytes,
    artifact,
    `Storage activation integrity failed for ${artifact.remotePath}.`,
  );

  const requiredMetadata = {
    ...identifyingMetadata,
    sha256: artifact.sha256,
    publicationState: 'ACTIVE',
  };
  const [current] = await remoteFile.getMetadata();
  if (!metadataMatches(current.metadata, requiredMetadata)) {
    await remoteFile.setMetadata({ metadata: { ...current.metadata, ...requiredMetadata } });
  }
  await verifyCustomMetadata(remoteFile, requiredMetadata);
}
