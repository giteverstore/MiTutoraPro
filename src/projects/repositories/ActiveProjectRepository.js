import { collection, doc, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase/firestore.js';
import { normalizeProjectFileSnapshot } from '../execution/projectFilesystem.js';

export const ACTIVE_PROJECT_SCHEMA_VERSION = 1;

export class ActiveProjectConflictError extends Error {
  constructor(remote) {
    super('This project was updated in another browser. Reload its latest cloud copy before saving again.');
    this.name = 'ActiveProjectConflictError';
    this.code = 'projects/conflict';
    this.remote = remote;
  }
}

const segment = (value, label) => {
  const result = String(value ?? '').trim();
  if (!result || result.includes('/')) throw new TypeError(`${label} must be a Firestore path segment.`);
  return result;
};
const fileId = (path) => encodeURIComponent(path);
const projectRef = (uid, projectId) => doc(db, 'users', segment(uid, 'uid'), 'activeProjects', segment(projectId, 'projectId'));
const filesRef = (uid, projectId) => collection(projectRef(uid, projectId), 'files');
const timestamp = (value) => typeof value === 'string' && value ? value : new Date().toISOString();

function metadataFromState(projectId, state, revision, fileIds) {
  return {
    schemaVersion: ACTIVE_PROJECT_SCHEMA_VERSION,
    projectId,
    displayName: typeof state.displayName === 'string' ? state.displayName.trim().slice(0, 80) || null : null,
    languageId: state.languageId,
    status: state.status,
    currentCheckpoint: state.currentCheckpoint ?? 0,
    completedCheckpoints: [...new Set(state.completedCheckpoints ?? [])].slice(0, 100),
    folders: [...new Set(state.folders ?? state.workspace?.folders ?? [])].slice(0, 128),
    entryFilePath: state.entryFilePath ?? state.workspace?.entryFilePath ?? null,
    fileIds,
    revision,
    createdAt: timestamp(state.createdAt),
    startedAt: state.startedAt ?? null,
    completedAt: state.completedAt ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export class ActiveProjectRepository {
  constructor(uid) { this.uid = segment(uid, 'uid'); }

  async load(projectId) {
    const reference = projectRef(this.uid, projectId);
    return runTransaction(db, async (transaction) => {
      const metadataSnapshot = await transaction.get(reference);
      if (!metadataSnapshot.exists()) return null;
      const metadata = metadataSnapshot.data();
      if (metadata.schemaVersion !== ACTIVE_PROJECT_SCHEMA_VERSION) throw new Error(`Unsupported active project schema: ${metadata.schemaVersion}`);
      const snapshots = await Promise.all((metadata.fileIds ?? []).map((id) => transaction.get(doc(filesRef(this.uid, projectId), id))));
      const files = Object.fromEntries(snapshots.filter((snapshot) => snapshot.exists()).map((snapshot) => {
        const file = snapshot.data();
        return [file.path, file];
      }));
      return { ...metadata, files, workspace: { files, folders: metadata.folders ?? [], entryFilePath: metadata.entryFilePath } };
    });
  }

  async save(projectId, state, expectedRevision = 0) {
    const normalizedFiles = normalizeProjectFileSnapshot(state.files ?? state.workspace?.files ?? {});
    const nextIds = Object.keys(normalizedFiles).map(fileId);
    const reference = projectRef(this.uid, projectId);
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const remote = snapshot.exists() ? snapshot.data() : null;
      const remoteRevision = remote?.revision ?? 0;
      if (remoteRevision !== expectedRevision) throw new ActiveProjectConflictError(remote);
      const revision = remoteRevision + 1;
      const metadata = metadataFromState(projectId, state, revision, nextIds);
      for (const oldId of remote?.fileIds ?? []) if (!nextIds.includes(oldId)) transaction.delete(doc(filesRef(this.uid, projectId), oldId));
      for (const file of Object.values(normalizedFiles)) transaction.set(doc(filesRef(this.uid, projectId), fileId(file.path)), file);
      transaction.set(reference, metadata);
      return { ...metadata, files: normalizedFiles, workspace: { files: normalizedFiles, folders: metadata.folders, entryFilePath: metadata.entryFilePath } };
    });
  }
}
