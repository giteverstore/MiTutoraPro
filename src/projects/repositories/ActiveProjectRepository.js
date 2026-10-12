import { collection, doc, getDoc, getDocs, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase/firestore.js';
import { normalizeProjectFileSnapshot } from '../execution/projectFilesystem.js';
import { MAX_PROGRESS_ITEMS } from '../../../shared/content/progression.js';

export const ACTIVE_PROJECT_SCHEMA_VERSION = 3;

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
const projectRef = (firestore, uid, projectId) => doc(firestore, 'users', segment(uid, 'uid'), 'activeProjects', segment(projectId, 'projectId'));
const childrenRef = (firestore, uid, projectId, kind) => collection(projectRef(firestore, uid, projectId), kind);
const timestamp = (value) => typeof value === 'string' && value ? value : new Date().toISOString();
const stateId = (value, label) => {
  const id = segment(value, label);
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(id) || id.length > 120) throw new TypeError(`${label} is invalid.`);
  return id;
};
const evidence = (source) => {
  const value = source?.validationEvidence;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const results = Array.isArray(value.results) ? value.results.slice(0, 50) : [];
  return {
    validatedAt: value.validatedAt,
    validatorSetVersion: value.validatorSetVersion,
    passed: value.passed === true,
    resultCount: results.length || (Number.isSafeInteger(value.resultCount) ? value.resultCount : 0),
    passedCount: results.length ? results.filter((result) => result.passed === true).length : (Number.isSafeInteger(value.passedCount) ? value.passedCount : 0),
  };
};
const taskDocument = (projectId, taskId, value) => ({ projectId, taskId, status: value.status, startedAt: value.startedAt ?? null, verifiedAt: value.verifiedAt ?? null, completedAt: value.completedAt ?? null, validationEvidence: evidence(value) });
const checkpointDocument = (projectId, checkpointId, value) => ({ projectId, checkpointId, status: value.status, completedAt: value.completedAt ?? null, validationEvidence: evidence(value) });
const finalDocument = (projectId, value) => ({ projectId, status: value.status, completedAt: value.completedAt ?? null, validationEvidence: evidence(value) });
const withoutIdentity = (value, key) => { const { projectId: _projectId, [key]: _id, ...state } = value; return state; };
const sorted = (value) => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sorted(item)])) : value;
const same = (left, right) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));

function metadataFromState(projectId, state, revision) {
  return {
    schemaVersion: ACTIVE_PROJECT_SCHEMA_VERSION,
    projectId,
    contentVersion: Number.isSafeInteger(state.contentVersion) ? state.contentVersion : null,
    displayName: typeof state.displayName === 'string' ? state.displayName.trim().slice(0, 80) || null : null,
    languageId: state.languageId,
    status: state.status,
    currentCheckpoint: state.currentCheckpoint ?? 0,
    activeCheckpointId: state.activeCheckpointId ?? null,
    activeTaskId: state.activeTaskId ?? null,
    entryFilePath: state.entryFilePath ?? state.workspace?.entryFilePath ?? null,
    revision,
    createdAt: timestamp(state.createdAt),
    startedAt: state.startedAt ?? null,
    completedAt: state.completedAt ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export class ActiveProjectRepository {
  constructor(uid, firestore = db) { this.uid = segment(uid, 'uid'); this.firestore = firestore; }

  async load(projectId) {
    const reference = projectRef(this.firestore, this.uid, projectId);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const metadataSnapshot = await getDoc(reference);
      if (!metadataSnapshot.exists()) return null;
      const metadata = metadataSnapshot.data();
      if (![1, 2, ACTIVE_PROJECT_SCHEMA_VERSION].includes(metadata.schemaVersion)) throw new Error(`Unsupported active project schema: ${metadata.schemaVersion}`);
      const [fileQuery, folderQuery] = metadata.schemaVersion === ACTIVE_PROJECT_SCHEMA_VERSION
        ? await Promise.all([
          getDocs(childrenRef(this.firestore, this.uid, projectId, 'files')),
          getDocs(childrenRef(this.firestore, this.uid, projectId, 'folders')),
        ]) : [null, null];
      const snapshots = fileQuery?.docs ?? await Promise.all((metadata.fileIds ?? []).map((id) => getDoc(doc(childrenRef(this.firestore, this.uid, projectId, 'files'), id))));
      const files = Object.fromEntries(snapshots.filter((snapshot) => snapshot.exists()).map((snapshot) => {
        const file = snapshot.data();
        return [file.path, file];
      }));
      let progress = {};
      if (metadata.schemaVersion === ACTIVE_PROJECT_SCHEMA_VERSION) {
        const [tasks, checkpoints, final] = await Promise.all([
          getDocs(childrenRef(this.firestore, this.uid, projectId, 'tasks')),
          getDocs(childrenRef(this.firestore, this.uid, projectId, 'checkpoints')),
          getDoc(doc(childrenRef(this.firestore, this.uid, projectId, 'final'), 'validation')),
        ]);
        progress = {
          taskProgress: Object.fromEntries(tasks.docs.map((item) => [item.id, withoutIdentity(item.data(), 'taskId')])),
          checkpointProgress: Object.fromEntries(checkpoints.docs.map((item) => [item.id, withoutIdentity(item.data(), 'checkpointId')])),
          finalValidation: final.exists() ? withoutIdentity(final.data(), 'statusUnused') : {},
          completedCheckpoints: checkpoints.docs.filter((item) => item.data().status === 'COMPLETED').map((item) => item.id).sort(),
          folders: folderQuery.docs.map((item) => item.data().path).sort(),
        };
      }
      const after = await getDoc(reference);
      if (after.exists() && after.data().revision === metadata.revision) return { ...metadata, ...progress, files, workspace: { files, folders: progress.folders ?? metadata.folders ?? [], entryFilePath: metadata.entryFilePath } };
    }
    throw new Error('Project changed while loading; retry.');
  }

  async save(projectId, state, expectedRevision = 0) {
    const normalizedFiles = normalizeProjectFileSnapshot(state.files ?? state.workspace?.files ?? {});
    const nextFileIds = new Set(Object.keys(normalizedFiles).map(fileId));
    const reference = projectRef(this.firestore, this.uid, projectId);
    const taskCollection = childrenRef(this.firestore, this.uid, projectId, 'tasks');
    const checkpointCollection = childrenRef(this.firestore, this.uid, projectId, 'checkpoints');
    const folderCollection = childrenRef(this.firestore, this.uid, projectId, 'folders');
    const filesCollection = childrenRef(this.firestore, this.uid, projectId, 'files');
    const finalReference = doc(childrenRef(this.firestore, this.uid, projectId, 'final'), 'validation');
    const [oldTasks, oldCheckpoints, oldFinal, oldFolders, oldFiles] = await Promise.all([getDocs(taskCollection), getDocs(checkpointCollection), getDoc(finalReference), getDocs(folderCollection), getDocs(filesCollection)]);
    const taskDocs = Object.fromEntries(Object.entries(state.taskProgress ?? {}).map(([id, value]) => [stateId(id, 'taskId'), taskDocument(projectId, id, value)]));
    const checkpointDocs = Object.fromEntries(Object.entries(state.checkpointProgress ?? {}).map(([id, value]) => [stateId(id, 'checkpointId'), checkpointDocument(projectId, id, value)]));
    for (const id of state.completedCheckpoints ?? []) {
      const checked = stateId(id, 'checkpointId');
      if (!checkpointDocs[checked]) checkpointDocs[checked] = { projectId, checkpointId: checked, status: 'COMPLETED', completedAt: timestamp(state.completedAt), validationEvidence: null };
    }
    if (Object.keys(taskDocs).length + Object.keys(checkpointDocs).length > MAX_PROGRESS_ITEMS) throw new RangeError('Project progress has too many entries.');
    const folders = [...new Set(state.folders ?? state.workspace?.folders ?? [])];
    if (folders.length > 128) throw new RangeError('Project workspace has too many folders.');
    const folderDocs = Object.fromEntries(folders.map((path) => [fileId(path), { projectId, path }]));
    const final = state.finalValidation?.status ? finalDocument(projectId, state.finalValidation) : null;
    const changedCount = (old, next) => old.docs.filter((item) => !(item.id in next)).length
      + Object.entries(next).filter(([id, value]) => !same(old.docs.find((item) => item.id === id)?.data(), value)).length;
    const fileDocs = Object.fromEntries(Object.values(normalizedFiles).map((file) => [fileId(file.path), file]));
    const writeCount = 1 + changedCount(oldFiles, fileDocs) + changedCount(oldFolders, folderDocs)
      + changedCount(oldTasks, taskDocs) + changedCount(oldCheckpoints, checkpointDocs)
      + (same(oldFinal.exists() ? oldFinal.data() : null, final) ? 0 : 1);
    if (writeCount > 450) throw new RangeError('Project save exceeds the atomic write limit.');
    return runTransaction(this.firestore, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const remote = snapshot.exists() ? snapshot.data() : null;
      const remoteRevision = remote?.revision ?? 0;
      if (remoteRevision !== expectedRevision) throw new ActiveProjectConflictError(remote);
      const revision = remoteRevision + 1;
      const metadata = metadataFromState(projectId, state, revision);
      for (const item of oldFiles.docs) if (!nextFileIds.has(item.id)) transaction.delete(item.ref);
      for (const file of Object.values(normalizedFiles)) if (!same(oldFiles.docs.find((item) => item.id === fileId(file.path))?.data(), file)) transaction.set(doc(filesCollection, fileId(file.path)), file);
      for (const item of oldFolders.docs) if (!(item.id in folderDocs)) transaction.delete(item.ref);
      for (const [id, value] of Object.entries(folderDocs)) if (!same(oldFolders.docs.find((item) => item.id === id)?.data(), value)) transaction.set(doc(folderCollection, id), value);
      for (const item of oldTasks.docs) if (!(item.id in taskDocs)) transaction.delete(item.ref);
      for (const [id, value] of Object.entries(taskDocs)) if (!same(oldTasks.docs.find((item) => item.id === id)?.data(), value)) transaction.set(doc(taskCollection, id), value);
      for (const item of oldCheckpoints.docs) if (!(item.id in checkpointDocs)) transaction.delete(item.ref);
      for (const [id, value] of Object.entries(checkpointDocs)) if (!same(oldCheckpoints.docs.find((item) => item.id === id)?.data(), value)) transaction.set(doc(checkpointCollection, id), value);
      if (final && !same(oldFinal.exists() ? oldFinal.data() : null, final)) transaction.set(finalReference, final);
      if (!final && oldFinal.exists()) transaction.delete(finalReference);
      transaction.set(reference, metadata);
      return { ...metadata, completedCheckpoints: state.completedCheckpoints ?? [], folders, taskProgress: state.taskProgress ?? {}, checkpointProgress: state.checkpointProgress ?? {}, finalValidation: state.finalValidation ?? {}, files: normalizedFiles, workspace: { files: normalizedFiles, folders, entryFilePath: metadata.entryFilePath } };
    });
  }

  async delete(projectId, expectedRevision) {
    const reference = projectRef(this.firestore, this.uid, projectId);
    const collections = ['files', 'folders', 'tasks', 'checkpoints', 'final'];
    const snapshots = await Promise.all(collections.map((kind) => getDocs(childrenRef(this.firestore, this.uid, projectId, kind))));
    if (1 + snapshots.reduce((total, group) => total + group.size, 0) > 450) throw new RangeError('Project delete exceeds the atomic write limit.');
    return runTransaction(this.firestore, async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) return false;
      if (snapshot.data().revision !== expectedRevision) throw new ActiveProjectConflictError(snapshot.data());
      for (const group of snapshots) for (const child of group.docs) transaction.delete(child.ref);
      transaction.delete(reference);
      return true;
    });
  }
}
