import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const metadataPath = resolve('firebase-content/firestore/practiceQuestions.json');
const contentRoot = resolve('firebase-content/practice/python/v1');
const protectedMarkers = ['protectedTests', 'referenceImplementations'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const filePosition = (name) => Number(name.slice('question-'.length, -'.json'.length));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function loadPracticeBundle() {
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  const fileNames = (await readdir(contentRoot))
    .filter((name) => /^question-\d+\.json$/.test(name))
    .sort((left, right) => filePosition(left) - filePosition(right));

  assert(Array.isArray(metadata), 'Practice metadata must be an array.');
  assert(metadata.length === 200, `Expected 200 Practice metadata records; found ${metadata.length}.`);
  assert(fileNames.length === 200, `Expected 200 Practice content files; found ${fileNames.length}.`);
  assert(fileNames.every((name, index) => name === `question-${index + 1}.json`), 'Practice content positions must be contiguous from 1 through 200.');

  const files = await Promise.all(fileNames.map(async (name, index) => {
    const localPath = resolve(contentRoot, name);
    const bytes = await readFile(localPath);
    const text = bytes.toString('utf8');
    const content = JSON.parse(text);
    const record = metadata[index];

    assert(record?.id === content.id, `${name} does not match its Firestore metadata ID.`);
    assert(record.published === true, `${record.id} must be published.`);
    assert(record.version === 'v1', `${record.id} must target version v1.`);
    assert(record.storagePath === `practice/python/${name}`, `${record.id} has an unexpected storagePath.`);
    assert(!protectedMarkers.some((marker) => text.includes(marker)), `${name} exposes validator-only content.`);

    return {
      localPath,
      remotePath: `practice/python/v1/${name}`,
      size: bytes.byteLength,
      sha256: sha256(bytes),
      id: content.id,
      position: index + 1,
    };
  }));

  const ids = metadata.map(({ id }) => id);
  assert(new Set(ids).size === metadata.length, 'Practice metadata contains duplicate IDs.');
  assert(ids[181] === 'fund-errors-001' && ids[199] === 'fund-errors-019', 'Batch 10 must occupy positions 182 through 200.');

  return {
    projectId: 'mi-tutora-pro',
    bucket: 'mi-tutora-pro.firebasestorage.app',
    collection: 'practiceQuestions',
    metadata,
    files,
  };
}
