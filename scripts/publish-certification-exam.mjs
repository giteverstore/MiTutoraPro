import { readFile } from 'node:fs/promises';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const examId = process.argv[2] ?? 'python-foundations-certification';
const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT;
if (!projectId) throw new Error('Set FIREBASE_PROJECT_ID before publishing certification metadata.');
const path = `firebase-content/certification-exams/${examId}.json`;
const metadata = JSON.parse(await readFile(path, 'utf8'));
if (metadata.id !== examId || !metadata.courseId || !metadata.version || metadata.published !== true) {
  throw new Error(`Invalid certification metadata in ${path}.`);
}
if (JSON.stringify(metadata).includes('correctOptionId')) throw new Error('Certification metadata must never contain answer keys.');
const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
await getFirestore(app).doc(`certificationExams/${examId}`).set(metadata, { merge: true });
console.log(`Published certificationExams/${examId} (${metadata.version}).`);
