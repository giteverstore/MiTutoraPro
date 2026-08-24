import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { practiceQuestions } from '../src/practice/practiceData.js';
import { dailyChallenge } from '../src/challenges/challengeData.js';
import { validatePracticeComplexity } from '../src/content/validation/contentLimits.js';

const version = 'v1';
const root = resolve('firebase-content');
const practiceRoot = resolve(root, 'practice/python', version);
const challengeRoot = resolve(root, 'daily-challenges/python', version);
const firestoreRoot = resolve(root, 'firestore');

await Promise.all([practiceRoot, challengeRoot, firestoreRoot].map((directory) =>
  mkdir(directory, { recursive: true })));

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
practiceQuestions.forEach((question) => validatePracticeComplexity(question));
const practiceArtifacts = practiceQuestions.map((question, index) => ({
  question,
  index,
  text: `${JSON.stringify(question, null, 2)}\n`,
}));
const practiceMetadata = practiceArtifacts.map(({ question, index, text }) => {
  const fileName = `question-${index + 1}.json`;
  return {
    id: question.id,
    title: question.title,
    summary: question.summary,
    language: question.language,
    topic: question.topic,
    category: question.category,
    subtopic: question.subtopic,
    questionType: question.questionType,
    skills: question.skills,
    difficulty: question.difficulty,
    estimatedMinutes: question.estimatedMinutes,
    xp: question.xp,
    position: index + 1,
    published: true,
    version,
    storagePath: `practice/python/${fileName}`,
    contentHash: sha256(text),
  };
});

await Promise.all(practiceArtifacts.map(({ index, text }) =>
  writeFile(resolve(practiceRoot, `question-${index + 1}.json`), text)));

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
