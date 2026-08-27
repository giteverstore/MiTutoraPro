import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContentPublicationProtocol } from '../../scripts/publishing/ContentPublicationProtocol.mjs';
import { activateStorageArtifact, reconcileStorageArtifact } from '../../scripts/publishing/StorageArtifactIntegrity.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

const createBucket = (initial = null) => {
  const state = {
    bytes: initial?.bytes ? Buffer.from(initial.bytes) : null,
    metadata: initial?.metadata ? { ...initial.metadata } : {},
    uploads: 0,
    metadataWrites: 0,
  };
  const remoteFile = {
    name: 'practice/python/v1/question-1.json',
    exists: async () => [state.bytes !== null],
    download: async () => [Buffer.from(state.bytes)],
    getMetadata: async () => [{ metadata: { ...state.metadata } }],
    setMetadata: async ({ metadata }) => {
      state.metadata = { ...metadata };
      state.metadataWrites += 1;
    },
  };
  return {
    state,
    file: () => remoteFile,
    upload: async (localPath, { metadata }) => {
      state.bytes = await readFile(localPath);
      state.metadata = { ...metadata.metadata };
      state.uploads += 1;
    },
  };
};

describe('Storage artifact publication integrity', () => {
  let directory;
  let artifact;
  const canonicalBytes = Buffer.from('{"id":"question-1"}\n', 'utf8');
  const identity = { contentType: 'practice-question', questionId: 'question-1', version: 'v1' };

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'mitutora-storage-integrity-'));
    const localPath = join(directory, 'question-1.json');
    await writeFile(localPath, canonicalBytes);
    artifact = {
      id: 'question-1',
      localPath,
      remotePath: 'practice/python/v1/question-1.json',
      size: canonicalBytes.byteLength,
      sha256: digest(canonicalBytes),
    };
  });

  afterEach(async () => rm(directory, { recursive: true, force: true }));

  const reconcile = (bucket) => reconcileStorageArtifact({
    bucket,
    artifact,
    identifyingMetadata: identity,
    mismatchMessage: 'immutable byte mismatch',
  });

  it('uploads new objects with canonical SHA-256 metadata', async () => {
    const bucket = createBucket();
    await reconcile(bucket);
    expect(bucket.state.uploads).toBe(1);
    expect(bucket.state.metadata).toMatchObject({ sha256: artifact.sha256, publicationState: 'INACTIVE' });
  });

  it('backfills a missing SHA-256 without replacing matching bytes', async () => {
    const bucket = createBucket({ bytes: canonicalBytes, metadata: { publicationState: 'ACTIVE' } });
    await reconcile(bucket);
    expect(bucket.state.uploads).toBe(0);
    expect(bucket.state.metadataWrites).toBe(1);
    expect(bucket.state.metadata).toMatchObject({ sha256: artifact.sha256, publicationState: 'ACTIVE' });
  });

  it('does not rewrite metadata that is already canonical', async () => {
    const bucket = createBucket({ bytes: canonicalBytes, metadata: { ...identity, sha256: artifact.sha256, publicationState: 'ACTIVE' } });
    await reconcile(bucket);
    expect(bucket.state.uploads).toBe(0);
    expect(bucket.state.metadataWrites).toBe(0);
  });

  it('corrects an incorrect SHA-256 only after matching the canonical bytes', async () => {
    const bucket = createBucket({ bytes: canonicalBytes, metadata: { ...identity, sha256: 'incorrect', publicationState: 'ACTIVE' } });
    await reconcile(bucket);
    expect(bucket.state.metadataWrites).toBe(1);
    expect(bucket.state.metadata.sha256).toBe(artifact.sha256);
  });

  it('fails safely without writes when existing bytes differ', async () => {
    const bucket = createBucket({ bytes: Buffer.from('different'), metadata: { sha256: 'incorrect' } });
    await expect(reconcile(bucket)).rejects.toThrow('immutable byte mismatch');
    expect(bucket.state.uploads).toBe(0);
    expect(bucket.state.metadataWrites).toBe(0);
  });

  it('cannot activate an artifact after its bytes fail integrity verification', async () => {
    const bucket = createBucket({ bytes: Buffer.from('different'), metadata: { publicationState: 'INACTIVE' } });
    await expect(activateStorageArtifact({
      remoteFile: bucket.file(artifact.remotePath),
      artifact,
      identifyingMetadata: identity,
    })).rejects.toThrow('Storage activation integrity failed');
    expect(bucket.state.metadataWrites).toBe(0);
    expect(bucket.state.metadata.publicationState).toBe('INACTIVE');
  });

  it('is idempotent when reconciliation and activation are rerun', async () => {
    const bucket = createBucket();
    await reconcile(bucket);
    await activateStorageArtifact({ remoteFile: bucket.file(artifact.remotePath), artifact, identifyingMetadata: identity });
    const writesAfterFirstRun = bucket.state.metadataWrites;
    await reconcile(bucket);
    await activateStorageArtifact({ remoteFile: bucket.file(artifact.remotePath), artifact, identifyingMetadata: identity });
    expect(bucket.state.uploads).toBe(1);
    expect(bucket.state.metadataWrites).toBe(writesAfterFirstRun);
    expect(bucket.state.metadata).toMatchObject({ sha256: artifact.sha256, publicationState: 'ACTIVE' });
  });

  it('never activates a new version or replaces the previous pointer after integrity failure', async () => {
    const protocol = new ContentPublicationProtocol();
    let activeVersion = 'v0';
    let activationCalls = 0;
    await expect(protocol.execute({
      upload: async () => {},
      verify: async () => { throw new Error('integrity failure'); },
      markReady: async () => {},
      activate: async () => { activationCalls += 1; activeVersion = 'v1'; },
    })).rejects.toThrow('integrity failure');
    expect(activationCalls).toBe(0);
    expect(activeVersion).toBe('v0');
  });
});
