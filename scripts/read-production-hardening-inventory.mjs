import { createHash } from 'node:crypto';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = process.env.FIREBASE_PROJECT_ID;
if (projectId !== 'mi-tutora-pro') throw new Error('Expected mi-tutora-pro.');
initializeApp({ credential: applicationDefault(), projectId, storageBucket: `${projectId}.firebasestorage.app` });
const db = getFirestore();
const bucket = getStorage().bucket();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const collections = ['practiceQuestions', 'courses', 'contentPublications', 'dailyChallenges'];
const firestore = {};
const paths = new Set();
const activePrefixes = new Set();
for (const name of collections) {
  const snap = await db.collection(name).get();
  const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  rows.forEach((row) => {
    if (row.storagePath) {
      paths.add(row.storagePath);
      const file = row.storagePath.split('/').at(-1);
      const versioned = row.storagePath.includes(`/${row.version}/`) ? row.storagePath : row.storagePath.replace(`/${file}`, `/${row.version}/${file}`);
      paths.add(versioned);
      if (name === 'courses') activePrefixes.add(`${row.storagePath}/${row.version}/`);
    }
  });
  firestore[name] = {
    count: rows.length,
    published: rows.filter((row) => row.published === true).length,
    versions: [...new Set(rows.map((row) => row.version).filter(Boolean))],
    hashCoverage: rows.filter((row) => row.contentHash || row.manifestHash || row.fileHashes).length,
    sample: rows.slice(0, 3).map((row) => ({ id: row.id, version: row.version, published: row.published, storagePath: row.storagePath, hasHash: Boolean(row.contentHash || row.manifestHash || row.fileHashes) })),
  };
}
const storage = {};
for (const prefix of ['course-content/', 'practice/', 'daily-challenges/']) {
  const [files] = await bucket.getFiles({ prefix });
  const rows = [];
  for (const file of files) {
    const [meta] = await file.getMetadata();
    const [bytes] = await file.download();
    const expected = meta.metadata?.sha256 || meta.metadata?.contentHash || null;
    let localHash = null;
    try { localHash = hash(await readFile(resolve('firebase-content', file.name))); } catch { /* no local artifact */ }
    rows.push({ path: file.name, state: meta.metadata?.publicationState ?? null, hasHash: Boolean(expected), matches: expected ? expected === hash(bytes) : null, localMatches: localHash ? localHash === hash(bytes) : null, referenced: paths.has(file.name) || [...activePrefixes].some((active) => file.name.startsWith(active)) });
  }
  storage[prefix] = {
    count: rows.length,
    active: rows.filter((row) => row.state === 'ACTIVE').length,
    inactive: rows.filter((row) => row.state === 'INACTIVE').length,
    missingState: rows.filter((row) => !row.state).length,
    withHash: rows.filter((row) => row.hasHash).length,
    mismatched: rows.filter((row) => row.matches === false).length,
    localComparable: rows.filter((row) => row.localMatches !== null).length,
    localMismatched: rows.filter((row) => row.localMatches === false).map((row) => row.path),
    unreferenced: rows.filter((row) => !row.referenced).map((row) => row.path),
    legacy: rows.filter((row) => !row.state || !row.hasHash).map((row) => row.path),
  };
}
console.log(JSON.stringify({ projectId, mode: 'READ_ONLY', mutationCount: 0, firestore, storage }, null, 2));
