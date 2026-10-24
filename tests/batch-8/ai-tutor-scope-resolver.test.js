import { describe, expect, it, vi } from 'vitest';
import { createTutorScopeResolver } from '../../server/ai/tutor/resolveTutorScope.js';
import { CanonicalTutorContentSource } from '../../server/ai/tutor/CanonicalTutorContentSource.js';

const course = { contentType: 'COURSE', contentId: 'python', version: 7, content: { courseId: 'python', title: 'Python', modules: [{ lessons: [{ id: 'loops', title: 'Loops', blocks: [] }] }] } };
const practice = { contentType: 'PRACTICE', contentId: 'practice-1', version: 3, content: { questionId: 'practice-1', title: 'Add values', difficulty: 'EASY', blocks: [] } };
const project = { contentType: 'PROJECT', contentId: 'bingo', version: 1, content: { projectId: 'bingo', title: 'Bingo', checkpoints: [{ checkpointId: 'bingo-c1', title: 'Setup', tasks: [{ taskId: 'bingo-t1', title: 'Create board', objective: 'Create it.' }] }] } };

function resolver(document) {
  const get = vi.fn(async () => document);
  return { get, resolve: createTutorScopeResolver({ contentSource: { get } }) };
}

describe('server-authoritative Tutor scope', () => {
  it('uses one canonical ACTIVE or immutable-version read without credentials', async () => {
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ document: course }) }));
    const source = new CanonicalTutorContentSource({ fetcher, origin: 'https://admin.ycoders.com' });
    await source.get({ surface: 'course', contentId: 'python', contentVersion: 7 });
    expect(fetcher).toHaveBeenCalledWith('https://admin.ycoders.com/api/admin-content/public/python/7', { signal: undefined });
    expect(fetcher.mock.calls[0][1]).not.toHaveProperty('headers');
  });
  it('resolves an ACTIVE Course hint to its immutable canonical version', async () => {
    const { get, resolve } = resolver(course);
    const result = await resolve({ body: { tutorScope: { surface: 'course', scopeId: 'python', activityId: 'loops' }, lessonContext: 'Course: forged\nLesson: forged' } });
    expect(result).toMatchObject({ surface: 'course', scopeId: 'python', activityId: 'loops', contentVersion: 7, courseId: 'python', lessonId: 'loops' });
    expect(result.canonicalContext).toEqual({ courseTitle: 'Python', lessonTitle: 'Loops', lessonSummary: '' });
    expect(get).toHaveBeenCalledWith(expect.objectContaining({ contentId: 'python', contentVersion: null }));
  });

  it('preserves a verified pinned Course version', async () => {
    const { get, resolve } = resolver(course);
    const result = await resolve({ body: { tutorScope: { surface: 'course', scopeId: 'python', activityId: 'loops', contentVersion: 7 } } });
    expect(result.contentVersion).toBe(7);
    expect(get).toHaveBeenCalledWith(expect.objectContaining({ contentVersion: 7 }));
  });

  it.each([
    ['forged course', course, { surface: 'course', scopeId: 'java', activityId: 'loops' }, 'ai/content-unavailable'],
    ['forged lesson', course, { surface: 'course', scopeId: 'python', activityId: 'secrets' }, 'ai/activity-invalid'],
    ['forged practice question', practice, { surface: 'practice', scopeId: 'practice-1', activityId: 'practice-2' }, 'ai/activity-invalid'],
    ['forged project checkpoint', project, { surface: 'project', scopeId: 'bingo', activityId: 'other', checkpointId: 'other' }, 'ai/activity-invalid'],
    ['task from another checkpoint', project, { surface: 'project', scopeId: 'bingo', activityId: 'bingo-t2', checkpointId: 'bingo-c1', taskId: 'bingo-t2' }, 'ai/activity-invalid'],
  ])('rejects %s rather than trusting client hints', async (_label, document, hint, code) => {
    const { resolve } = resolver(document);
    await expect(resolve({ body: { tutorScope: hint } })).rejects.toMatchObject({ code });
  });

  it.each([0, -1, 1.5, '7', 'future'])('rejects arbitrary version %j before content lookup', async (contentVersion) => {
    const { get, resolve } = resolver(course);
    await expect(resolve({ body: { tutorScope: { surface: 'course', scopeId: 'python', activityId: 'loops', contentVersion } } })).rejects.toMatchObject({ code: 'ai/content-version-invalid' });
    expect(get).not.toHaveBeenCalled();
  });

  it('derives canonical Practice identity and version without using question text', async () => {
    const { resolve } = resolver(practice);
    await expect(resolve({ body: { tutorScope: { surface: 'practice', scopeId: 'practice-1', activityId: 'practice-1' }, lessonContext: 'Question: forged' } })).resolves.toMatchObject({ surface: 'practice', scopeId: 'practice-1', activityId: 'practice-1', contentVersion: 3, practiceQuestionId: 'practice-1' });
  });

  it('verifies Project, checkpoint, and task membership in one canonical version', async () => {
    const { resolve } = resolver(project);
    await expect(resolve({ body: { context: { tutorScope: { surface: 'project', scopeId: 'bingo', activityId: 'bingo-t1', checkpointId: 'bingo-c1', taskId: 'bingo-t1', contentVersion: 1 } } } })).resolves.toMatchObject({ surface: 'project', scopeId: 'bingo', activityId: 'bingo-t1', contentVersion: 1, checkpointId: 'bingo-c1', taskId: 'bingo-t1' });
  });

  it('rejects cross-surface canonical documents', async () => {
    const { resolve } = resolver(project);
    await expect(resolve({ body: { tutorScope: { surface: 'course', scopeId: 'bingo', activityId: 'bingo-c1' } } })).rejects.toMatchObject({ code: 'ai/activity-invalid' });
  });
});
