import { describe, expect, it, vi } from 'vitest';
import { practiceQuestions } from '../../src/practice/practiceData';
import { DAILY_CHALLENGE_ROTATION_POLICY, eligiblePracticeQuestions, generateDailyChallengeAssignments } from '../../src/challenges/dailyChallengeRotation';
import { ChallengeService } from '../../src/content/services/ChallengeService';
import { createChallengeMetadata } from '../../src/content/models/challengeMetadata';

const catalog = practiceQuestions.map((content) => ({ metadata: { id: content.id, published: true, difficulty: content.difficulty }, content }));
const range = (startDate, days) => {
  const end = new Date(`${startDate}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + days - 1);
  return end.toISOString().slice(0, 10);
};

describe('Daily Challenge Practice rotation', () => {
  it('creates content-free immutable references and converges on rerun', () => {
    const first = generateDailyChallengeAssignments({ startDate: '2026-09-13', catalog });
    const rerun = generateDailyChallengeAssignments({ startDate: '2026-09-13', catalog });
    expect(first).toEqual(rerun);
    expect(first[0]).toMatchObject({ id: '2026-09-13', date: '2026-09-13', published: true, policyVersion: 'daily-practice-rotation-v1', rewardCoins: 20, version: 'v1' });
    expect(first[0].practiceQuestionId).toMatch(/^fund-/);
    expect(first[0]).not.toHaveProperty('blocks');
    expect(first[0]).not.toHaveProperty('examples');
  });

  it('never overwrites an existing assignment when catalog order or contents change', () => {
    const persisted = { id: '2026-09-13', date: '2026-09-13', practiceQuestionId: 'fixed-question', difficulty: 'hard', published: true, policyVersion: 'daily-practice-rotation-v1', rewardCoins: 20, rewardXp: 0, version: 'v1' };
    expect(generateDailyChallengeAssignments({ startDate: persisted.date, catalog: [...catalog].reverse(), existingAssignments: [persisted] })[0]).toEqual(persisted);
  });

  it('excludes invalid, unpublished and compiler-incomplete questions', () => {
    const valid = catalog[0];
    const invalid = [
      { metadata: { id: 'wrong', published: true }, content: valid.content },
      { metadata: { id: valid.content.id, published: false }, content: valid.content },
      { metadata: { id: 'broken', published: true }, content: { ...valid.content, id: 'broken', blocks: [] } },
    ];
    expect(eligiblePracticeQuestions([valid, ...invalid])).toEqual([expect.objectContaining({ id: valid.content.id })]);
  });

  it('approaches 40/40/20 over 365 days without sequence violations', () => {
    const assignments = generateDailyChallengeAssignments({ startDate: '2026-01-01', endDate: '2026-12-31', catalog });
    const counts = { easy: 0, medium: 0, hard: 0 };
    assignments.forEach((assignment, index) => {
      counts[assignment.difficulty] += 1;
      expect(catalog.some(({ content }) => content.id === assignment.practiceQuestionId)).toBe(true);
      if (index) {
        expect(assignment.practiceQuestionId).not.toBe(assignments[index - 1].practiceQuestionId);
        expect(assignment.difficulty === 'hard' && assignments[index - 1].difficulty === 'hard').toBe(false);
      }
      if (index > 1) expect(new Set(assignments.slice(index - 2, index + 1).map(({ difficulty }) => difficulty)).size).toBeGreaterThan(1);
    });
    expect(counts.easy / assignments.length).toBeGreaterThan(0.37);
    expect(counts.easy / assignments.length).toBeLessThan(0.43);
    expect(counts.medium / assignments.length).toBeGreaterThan(0.37);
    expect(counts.medium / assignments.length).toBeLessThan(0.43);
    expect(counts.hard / assignments.length).toBeGreaterThan(0.17);
    expect(counts.hard / assignments.length).toBeLessThan(0.23);
  });

  it.each([
    ['no Hard pool', catalog.filter(({ content }) => content.difficulty !== 'hard')],
    ['small Easy pool', [...catalog.filter(({ content }) => content.difficulty !== 'easy'), catalog.find(({ content }) => content.difficulty === 'easy')]],
    ['small Medium pool', [...catalog.filter(({ content }) => content.difficulty !== 'medium'), catalog.find(({ content }) => content.difficulty === 'medium')]],
    ['small Hard pool', [...catalog.filter(({ content }) => content.difficulty !== 'hard'), catalog.find(({ content }) => content.difficulty === 'hard')]],
  ])('degrades safely with %s', (_name, smallCatalog) => {
    const assignments = generateDailyChallengeAssignments({ startDate: '2026-01-01', endDate: range('2026-01-01', 60), catalog: smallCatalog.filter(Boolean) });
    expect(assignments).toHaveLength(60);
    expect(assignments.every(({ practiceQuestionId }) => typeof practiceQuestionId === 'string')).toBe(true);
    expect(assignments.every((item, index) => !index || item.practiceQuestionId !== assignments[index - 1].practiceQuestionId)).toBe(true);
  });

  it('uses weighted targets rather than monthly quota configuration', () => {
    expect(DAILY_CHALLENGE_ROTATION_POLICY.weights).toEqual({ easy: 0.4, medium: 0.4, hard: 0.2 });
    expect(DAILY_CHALLENGE_ROTATION_POLICY).not.toHaveProperty('monthlyQuota');
  });

  it('resolves a reference through the canonical Practice source without persisting copied content', async () => {
    const question = practiceQuestions[0];
    const source = { getQuestion: vi.fn(async () => ({ content: { ...question, version: 'v2' } })) };
    const repository = { getMetadata: vi.fn(), invalidateMetadata: vi.fn() };
    const service = new ChallengeService(repository, source);
    const metadata = createChallengeMetadata({ id: '2026-09-13', date: '2026-09-13', practiceQuestionId: question.id, difficulty: question.difficulty, rewardCoins: 20, rewardXp: 0, published: true, policyVersion: 'daily-practice-rotation-v1', version: 'v1' });
    const resolved = await service.getChallengeFromMetadata(metadata);
    expect(source.getQuestion).toHaveBeenCalledWith(question.id);
    expect(resolved.content).toMatchObject({ id: question.id, date: '2026-09-13', reward: { coins: 20 } });
    expect(metadata).not.toHaveProperty('blocks');
  });

  it('handles complete pool exhaustion without failing generation', () => {
    const only = [catalog[0]];
    expect(generateDailyChallengeAssignments({ startDate: '2026-01-01', endDate: '2026-01-03', catalog: only })).toHaveLength(3);
  });
});
