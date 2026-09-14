import { practiceQuestions } from '../src/practice/practiceData.js';
import { generateDailyChallengeAssignments } from '../src/challenges/dailyChallengeRotation.js';
import practiceMetadata from '../firebase-content/firestore/practiceQuestions.json' with { type: 'json' };

const args = process.argv.slice(2);
const valueAfter = (name) => args[args.indexOf(name) + 1];
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const startDate = args.includes('--start') ? valueAfter('--start') : today;
const endDate = args.includes('--end') ? valueAfter('--end') : startDate;
const catalog = practiceQuestions.map((content) => ({
  metadata: practiceMetadata.find(({ id }) => id === content.id), content,
}));
const assignments = generateDailyChallengeAssignments({ startDate, endDate, catalog });

// Preview only. Persistence belongs to an explicitly authenticated admin/emulator workflow.
process.stdout.write(`${JSON.stringify(assignments, null, 2)}\n`);
