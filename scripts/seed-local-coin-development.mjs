import { readFile } from 'node:fs/promises';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

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

const platformDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const id = 'challenge-balanced-brackets';
const basePath = `daily-challenges/python/${platformDate}.json`;
const objectPath = `daily-challenges/python/v1/${platformDate}.json`;
const source = JSON.parse(await readFile(new URL('../firebase-content/daily-challenges/python/v1/2026-08-01.json', import.meta.url), 'utf8'));
const [practice] = JSON.parse(await readFile(new URL('../firebase-content/firestore/practiceQuestions.json', import.meta.url), 'utf8'));
const content = { ...source, id, date: platformDate, reward: { ...source.reward, coins: 20 } };
const app = initializeApp({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com` }, 'local-coin-seed');
try {
  await getFirestore(app).doc(`dailyChallenges/${id}`).set({
    id, date: platformDate, language: 'Python', difficulty: 'medium', rewardCoins: 20,
    rewardXp: 50, published: true, version: 'v1', storagePath: basePath,
  });
  await getFirestore(app).doc(`practiceQuestions/${practice.id}`).set(practice);
  await getStorage(app).bucket().file(objectPath).save(Buffer.from(`${JSON.stringify(content)}\n`), {
    resumable: false,
    metadata: { contentType: 'application/json', metadata: { publicationState: 'ACTIVE' } },
  });
  process.stdout.write(`Local canonical challenge and Practice metadata seeded for ${platformDate}.\n`);
} finally {
  await deleteApp(app);
}
