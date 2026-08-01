import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { practiceQuestions } from '../src/practice/practiceData.js';
import { dailyChallenge } from '../src/challenges/challengeData.js';

const version = 'v1';
const root = resolve('firebase-content');
const practiceRoot = resolve(root, 'practice/python', version);
const challengeRoot = resolve(root, 'daily-challenges/python', version);
const firestoreRoot = resolve(root, 'firestore');

await Promise.all([practiceRoot, challengeRoot, firestoreRoot].map((directory) =>
  mkdir(directory, { recursive: true })));

const practiceMetadata = practiceQuestions.map((question, index) => {
  const fileName = `question-${index + 1}.json`;
  return {
    id: question.id,
    title: question.title,
    language: question.language,
    topic: question.topic,
    difficulty: question.difficulty,
    estimatedMinutes: question.estimatedMinutes,
    xp: question.xp,
    published: true,
    version,
    storagePath: `practice/python/${fileName}`,
  };
});

await Promise.all(practiceQuestions.map((question, index) =>
  writeFile(resolve(practiceRoot, `question-${index + 1}.json`), `${JSON.stringify(question, null, 2)}\n`)));

const challengeFile = `${dailyChallenge.date}.json`;
const challengeMetadata = [{
  id: dailyChallenge.id,
  date: dailyChallenge.date,
  language: dailyChallenge.language,
  difficulty: dailyChallenge.difficulty,
  rewardCoins: dailyChallenge.reward.coins,
  rewardXp: 50,
  published: true,
  version,
  storagePath: `daily-challenges/python/${challengeFile}`,
}];

await writeFile(resolve(challengeRoot, challengeFile), `${JSON.stringify(dailyChallenge, null, 2)}\n`);
await writeFile(resolve(firestoreRoot, 'practiceQuestions.json'), `${JSON.stringify(practiceMetadata, null, 2)}\n`);
await writeFile(resolve(firestoreRoot, 'dailyChallenges.json'), `${JSON.stringify(challengeMetadata, null, 2)}\n`);

console.log(JSON.stringify({
  practiceQuestions: practiceQuestions.length,
  challenge: dailyChallenge.id,
  version,
  output: root,
}, null, 2));
