export const DAILY_CHALLENGE_ROTATION_POLICY = Object.freeze({
  version: 'daily-practice-rotation-v1',
  weights: Object.freeze({ easy: 0.4, medium: 0.4, hard: 0.2 }),
  rewardCoins: 20,
  assignmentVersion: 'v1',
});

const DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function canonicalDate(value) {
  if (!DATE.test(value ?? '')) throw new Error('Daily Challenge dates must use YYYY-MM-DD.');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Daily Challenge date is invalid.');
  return value;
}

function nextDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function asQuestion(entry) {
  const metadata = entry?.metadata ?? entry;
  const content = entry?.content ?? entry;
  return { metadata, content };
}

export function eligiblePracticeQuestions(catalog) {
  return (catalog ?? []).flatMap((entry) => {
    const { metadata, content } = asQuestion(entry);
    const difficulty = String(content?.difficulty ?? metadata?.difficulty ?? '').toLowerCase();
    const compilers = Array.isArray(content?.blocks) ? content.blocks.filter((block) => block?.type === 'compiler') : [];
    const validCompiler = compilers.some((compiler) => typeof compiler.language === 'string'
      && typeof compiler.starterCode === 'string'
      && (typeof compiler.expectedOutput === 'string' || Array.isArray(compiler.testCases)));
    if (!content || typeof content.id !== 'string' || metadata?.id !== content.id
      || metadata?.published === false || !DIFFICULTIES.includes(difficulty) || !validCompiler) return [];
    return [{ id: content.id, difficulty, content }];
  });
}

function chooseDifficulty(pools, sequence, policy) {
  const available = DIFFICULTIES.filter((difficulty) => pools.get(difficulty)?.length);
  if (!available.length) throw new Error('No eligible Practice questions are available.');
  const previous = sequence.at(-1)?.difficulty;
  const beforePrevious = sequence.at(-2)?.difficulty;
  let allowed = available.filter((difficulty) => difficulty !== 'hard' || previous !== 'hard');
  const withoutTriples = allowed.filter((difficulty) => !(difficulty === previous && difficulty === beforePrevious));
  if (withoutTriples.length) allowed = withoutTriples;
  const counts = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, sequence.filter((item) => item.difficulty === difficulty).length]));
  const targetLength = sequence.length + 1;
  return allowed.sort((left, right) => {
    const deficit = (difficulty) => policy.weights[difficulty] * targetLength - counts[difficulty];
    return deficit(right) - deficit(left) || DIFFICULTIES.indexOf(left) - DIFFICULTIES.indexOf(right);
  })[0];
}

function chooseQuestion(pool, assignments, date, policy) {
  const previousId = assignments.at(-1)?.practiceQuestionId;
  const lastUsed = new Map();
  assignments.forEach((assignment, index) => lastUsed.set(assignment.practiceQuestionId, index));
  const candidates = pool.filter(({ id }) => id !== previousId);
  const usable = candidates.length ? candidates : pool;
  const neverUsed = usable.filter(({ id }) => !lastUsed.has(id));
  const rotationPool = neverUsed.length ? neverUsed : usable.filter(({ id }) => lastUsed.get(id) === Math.min(...usable.map((item) => lastUsed.get(item.id) ?? -1)));
  return rotationPool[hash(`${policy.version}:${date}`) % rotationPool.length];
}

export function generateDailyChallengeAssignments({ startDate, endDate = startDate, catalog, existingAssignments = [], policy = DAILY_CHALLENGE_ROTATION_POLICY }) {
  canonicalDate(startDate); canonicalDate(endDate);
  if (endDate < startDate) throw new Error('Daily Challenge range end must not precede its start.');
  const eligible = eligiblePracticeQuestions(catalog);
  const pools = new Map(DIFFICULTIES.map((difficulty) => [difficulty, eligible.filter((question) => question.difficulty === difficulty)]));
  const existing = new Map(existingAssignments.map((assignment) => [canonicalDate(assignment.date), Object.freeze({ ...assignment })]));
  const sequence = [...existing.values()].filter((assignment) => assignment.date < startDate).sort((left, right) => left.date.localeCompare(right.date));
  const generated = [];
  for (let date = startDate; date <= endDate; date = nextDate(date)) {
    const persisted = existing.get(date);
    if (persisted) {
      generated.push(persisted); sequence.push(persisted); continue;
    }
    const difficulty = chooseDifficulty(pools, sequence, policy);
    const question = chooseQuestion(pools.get(difficulty), sequence, date, policy);
    const assignment = Object.freeze({
      id: date, date, practiceQuestionId: question.id, difficulty,
      rewardCoins: policy.rewardCoins, rewardXp: 0, published: true,
      policyVersion: policy.version, version: policy.assignmentVersion,
    });
    generated.push(assignment); sequence.push(assignment);
  }
  return Object.freeze(generated);
}
