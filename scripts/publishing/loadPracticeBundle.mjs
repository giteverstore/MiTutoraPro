import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CONTENT_LIMITS, assertLimit, utf8ByteLength, validatePracticeComplexity } from '../../src/content/validation/contentLimits.js';

const metadataPath = resolve('firebase-content/firestore/practiceQuestions.json');
const protectedMarkers = ['protectedTests', 'referenceImplementations'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const filePosition = (name) => Number(name.slice('question-'.length, -'.json'.length));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function loadPracticeBundle() {
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  assert(Array.isArray(metadata) && metadata.length > 0, 'Practice metadata must be a non-empty array.');
  metadata.forEach((record) => assertLimit(utf8ByteLength(record), CONTENT_LIMITS.practice.maxMetadataBytes, `Practice metadata ${record.id ?? '(unknown)'}`));
  const versions = [...new Set(metadata.map(({ version }) => version))];
  assert(versions.length === 1 && /^v[1-9]\d*$/.test(versions[0]), 'Practice metadata must target one valid version.');
  const version = versions[0];
  const contentRoot = resolve(`firebase-content/practice/python/${version}`);
  const fileNames = (await readdir(contentRoot))
    .filter((name) => /^question-\d+\.json$/.test(name))
    .sort((left, right) => filePosition(left) - filePosition(right));

  assert(fileNames.length === metadata.length, `Expected ${metadata.length} Practice content files; found ${fileNames.length}.`);
  assert(fileNames.every((name, index) => name === `question-${index + 1}.json`), 'Practice content positions must be contiguous from 1 through the catalog size.');

  const files = await Promise.all(fileNames.map(async (name, index) => {
    const localPath = resolve(contentRoot, name);
    const bytes = await readFile(localPath);
    const text = bytes.toString('utf8');
    const content = JSON.parse(text);
    validatePracticeComplexity(content);
    const record = metadata[index];

    assert(record?.id === content.id, `${name} does not match its Firestore metadata ID.`);
    assert(record.published === true, `${record.id} must be published.`);
    assert(record.version === version, `${record.id} must target version ${version}.`);
    assert(record.storagePath === `practice/python/${name}`, `${record.id} has an unexpected storagePath.`);
    assert(record.position === index + 1, `${record.id} has an unexpected catalog position.`);
    assert(!protectedMarkers.some((marker) => text.includes(marker)), `${name} exposes validator-only content.`);

    const contentHash = sha256(bytes);
    assert(record.contentHash === contentHash, `${record.id} metadata hash does not match its learner artifact.`);
    return {
      localPath,
      remotePath: `practice/python/${version}/${name}`,
      size: bytes.byteLength,
      sha256: contentHash,
      id: content.id,
      position: index + 1,
    };
  }));

  const ids = metadata.map(({ id }) => id);
  assert(new Set(ids).size === metadata.length, 'Practice metadata contains duplicate IDs.');

  return {
    projectId: 'mi-tutora-pro',
    bucket: 'mi-tutora-pro.firebasestorage.app',
    collection: 'practiceQuestions',
    publicationPath: 'contentPublications/practice-python',
    version,
    metadata,
    files,
  };
}
