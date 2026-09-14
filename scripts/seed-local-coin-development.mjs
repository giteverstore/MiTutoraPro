import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { readFile } from 'node:fs/promises';
import { practiceQuestions } from '../src/practice/practiceData.js';
import { generateDailyChallengeAssignments } from '../src/challenges/dailyChallengeRotation.js';
import { loadAndValidateCourseBundle } from './publishing/loadCourseBundle.mjs';
import practiceMetadata from '../firebase-content/firestore/practiceQuestions.json' with { type: 'json' };
import certificationExamMetadata from '../firebase-content/certification-exams/python-foundations-certification.json' with { type: 'json' };
import { kolkataDate } from '../src/home/challengeCalendar.js';

const PROJECT_ID = 'demo-mitutora-coins';
const required = {
  FIREBASE_PROJECT_ID: PROJECT_ID,
  GCLOUD_PROJECT: PROJECT_ID,
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  STORAGE_EMULATOR_HOST: 'http://127.0.0.1:9199',
};
for (const [name, value] of Object.entries(required)) {
  if (process.env[name] !== value) throw new Error(`Refusing to seed: ${name} is not the pinned local emulator value.`);
}

const platformDate = kolkataDate();
const shiftDate = (date, days) => {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};
const startDate = shiftDate(platformDate, -7);
const endDate = shiftDate(platformDate, 30);
const catalog = practiceQuestions.map((content) => ({ metadata: practiceMetadata.find(({ id }) => id === content.id), content }));
const app = initializeApp({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com` }, 'local-coin-seed');
try {
  const db = getFirestore(app);
  const bucket = getStorage(app).bucket();
  const courseBundle = await loadAndValidateCourseBundle('python');
  await db.doc(`courses/${courseBundle.metadata.id}`).set(courseBundle.metadata);
  for (const file of courseBundle.files) {
    const bytes = await readFile(file.localPath);
    await bucket.file(file.remotePath).save(bytes, {
      resumable: false,
      metadata: { contentType: 'application/json', metadata: { publicationState: 'ACTIVE' } },
    });
  }
  await db.doc(`certificationExams/${certificationExamMetadata.id}`).set(certificationExamMetadata);

  const existingSnapshot = await db.collection('dailyChallenges').get();
  const existingAssignments = existingSnapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
    .filter(({ date }) => date >= startDate && date <= endDate);
  const assignments = generateDailyChallengeAssignments({ startDate, endDate, catalog, existingAssignments });
  for (const assignment of assignments) {
    const reference = db.doc(`dailyChallenges/${assignment.id}`);
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(reference);
      if (!existing.exists) transaction.create(reference, assignment);
    });
  }
  const referencedIds = [...new Set(assignments.map(({ practiceQuestionId }) => practiceQuestionId))];
  for (const questionId of referencedIds) {
    const practice = practiceMetadata.find(({ id }) => id === questionId);
    if (!practice) throw new Error('Refusing to seed: generated Practice assignment is not canonical.');
    const objectPath = practice.storagePath.replace(/\/([^/]+)$/, `/${practice.version}/$1`);
    const sourcePath = new URL(`../firebase-content/${objectPath}`, import.meta.url);
    const bytes = await readFile(sourcePath);
    const practiceRef = db.doc(`practiceQuestions/${practice.id}`);
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(practiceRef);
      if (!existing.exists) transaction.create(practiceRef, practice);
    });
    const object = bucket.file(objectPath);
    const [objectExists] = await object.exists();
    if (!objectExists) {
      await object.save(bytes, {
        resumable: false,
        metadata: { contentType: 'application/json', metadata: { publicationState: 'ACTIVE' } },
      });
    }
  }
  process.stdout.write(`Local development content ready: Python ${courseBundle.metadata.version}; certification ${certificationExamMetadata.version}; Daily Challenges ${startDate} through ${endDate}; ${assignments.length} assignments; ${referencedIds.length} referenced Practice questions.\n`);
} finally {
  await deleteApp(app);
}
