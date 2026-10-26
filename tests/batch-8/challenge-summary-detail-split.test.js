import { describe, expect, it, vi } from 'vitest';
import { createChallengeContentSource } from '../../src/challenges/challengeContentSource.js';
import { ChallengeService } from '../../src/content/services/ChallengeService.js';

const metadata = (index, overrides = {}) => ({
  id: `2026-09-${String(index).padStart(2, '0')}`,
  date: `2026-09-${String(index).padStart(2, '0')}`,
  practiceQuestionId: `question-${index}`,
  title: `Challenge ${index}`,
  summary: `Summary ${index}`,
  language: 'Python',
  topic: 'Strings',
  category: 'Fundamentals',
  difficulty: index % 2 ? 'easy' : 'medium',
  estimatedMinutes: 12,
  rewardCoins: 20,
  rewardXp: 0,
  published: true,
  policyVersion: 'daily-practice-rotation-v1',
  version: 'v1',
  sourceType: 'practice-reference',
  ...overrides,
});

describe('Challenge summary/detail request boundary', () => {
  it('renders thirty metadata summaries without loading any full detail', async () => {
    const records = Array.from({ length: 30 }, (_, index) => metadata(index + 1));
    const service = {
      listMetadata: vi.fn(async () => records),
      getChallengeFromMetadata: vi.fn(),
    };
    const source = createChallengeContentSource({ service });

    const catalog = await source.loadPublishedChallengeCatalog('2026-09-30');

    expect(catalog).toHaveLength(30);
    expect(service.listMetadata).toHaveBeenCalledOnce();
    expect(service.getChallengeFromMetadata).not.toHaveBeenCalled();
    expect(catalog[0]).toMatchObject({
      metadata: { date: '2026-09-01', rewardCoins: 20 },
      content: { title: 'Challenge 1', summary: 'Summary 1', difficulty: 'easy', estimatedMinutes: 12 },
    });
    expect(catalog[0].content).not.toHaveProperty('blocks');
    expect(catalog[0].content).not.toHaveProperty('starterCode');
    expect(catalog[0].content).not.toHaveProperty('tests');
  });

  it('loads exactly one selected Practice-backed detail', async () => {
    const selected = metadata(13);
    const detail = { id: selected.practiceQuestionId, blocks: [{ type: 'compiler' }] };
    const service = {
      listMetadata: vi.fn(async () => [metadata(12), selected]),
      getChallengeFromMetadata: vi.fn(async () => ({ metadata: selected, content: detail })),
    };
    const source = createChallengeContentSource({ service });

    await expect(source.loadDailyChallengeByDate(selected.date)).resolves.toMatchObject({
      id: selected.practiceQuestionId,
      activityId: selected.id,
      version: selected.version,
    });
    expect(service.getChallengeFromMetadata).toHaveBeenCalledOnce();
    expect(service.getChallengeFromMetadata).toHaveBeenCalledWith(selected);
  });

  it('keeps Practice and Storage detail resolution on demand', async () => {
    const question = { id: 'practice-one', blocks: [{ type: 'compiler' }] };
    const practiceService = { getQuestion: vi.fn(async () => ({ content: question })) };
    const repository = {
      loadChallenge: vi.fn(async () => ({ id: 'storage-one', date: '2026-09-11', blocks: [{ type: 'compiler' }] })),
      invalidateMetadata: vi.fn(),
      invalidate: vi.fn(),
    };
    const service = new ChallengeService(repository, practiceService);
    const practice = metadata(10, { practiceQuestionId: question.id });
    const storage = metadata(11, { practiceQuestionId: undefined, storagePath: 'daily-challenges/python/challenge.json', sourceType: 'legacy-storage', language: 'Python' });

    await service.getChallengeFromMetadata(practice);
    expect(practiceService.getQuestion).toHaveBeenCalledOnce();
    expect(repository.loadChallenge).not.toHaveBeenCalled();

    await service.getChallengeFromMetadata(storage);
    expect(repository.loadChallenge).toHaveBeenCalledOnce();
    expect(repository.loadChallenge).toHaveBeenCalledWith(storage.storagePath, storage.version, expect.any(Object));
  });

  it('uses neutral metadata-only fallbacks for older published assignments', async () => {
    const legacy = metadata(9, { title: '', summary: '', estimatedMinutes: null });
    const service = { listMetadata: vi.fn(async () => [legacy]), getChallengeFromMetadata: vi.fn() };
    const source = createChallengeContentSource({ service });

    const [entry] = await source.loadPublishedChallengeCatalog('2026-09-30');
    expect(entry.content).toMatchObject({
      title: 'Daily Coding Challenge',
      summary: 'Practice your coding skills with this daily challenge.',
      estimatedMinutes: 15,
    });
    expect(service.getChallengeFromMetadata).not.toHaveBeenCalled();
  });
});
