import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { TrustedCompletionDevelopmentService } from '../../src/progress/TrustedCompletionDevelopmentService';

const python = JSON.parse(readFileSync(join(process.cwd(), 'public/courses/python-course.json'), 'utf8'));
const pythonPublication = JSON.parse(readFileSync(join(process.cwd(), 'firebase-content/firestore/courses/python.json'), 'utf8'));
const loadedPython = { ...python, publishedVersion: pythonPublication.version };
const java = JSON.parse(readFileSync(join(process.cwd(), 'public/courses/java-course.json'), 'utf8'));
const javaPublication = JSON.parse(readFileSync(join(process.cwd(), 'firebase-content/firestore/courses/java.json'), 'utf8'));
const loadedJava = { ...java, publishedVersion: javaPublication.version };

describe('trusted course completion development control', () => {
  it('uses canonical version and lesson identities sequentially for all 109 Python lessons', async () => {
    const calls = [];
    const completionService = { recordLessonCompletion: vi.fn(async (...args) => { calls.push(args); }) };
    const service = new TrustedCompletionDevelopmentService({ completionService });
    const result = await service.completeCourse(loadedPython);
    expect(result).toMatchObject({ completed: 109, total: 109, certification: { eligibilityStatus: 'ELIGIBLE' } });
    expect(calls[0]).toEqual(['python', 'v2', 'lesson-1-1-introduction-to-python']);
    expect(calls).toHaveLength(109);
    expect(calls.map(([, , lessonId]) => lessonId)).toEqual(loadedPython.modules.flatMap((module) => module.sections.flatMap((section) => section.lessons)).map(({ id }) => id));
  });

  it('uses the same canonical ordered path for Java', async () => {
    const calls = [];
    const completionService = { recordLessonCompletion: vi.fn(async (...args) => { calls.push(args); }) };
    const service = new TrustedCompletionDevelopmentService({ completionService });
    const lessons = loadedJava.modules.flatMap((module) => module.sections.flatMap((section) => section.lessons)).filter(({ required }) => required !== false);

    await service.completeCourse(loadedJava);

    expect(calls).toHaveLength(lessons.length);
    expect(calls[0]).toEqual(['java', 'v1', lessons[0].id]);
    expect(calls.map(([, , lessonId]) => lessonId)).toEqual(lessons.map(({ id }) => id));
  });

  it('converges partial/already-completed server state through idempotent ordered calls', async () => {
    const completionService = { recordLessonCompletion: vi.fn().mockResolvedValue({ duplicate: true }) };
    await new TrustedCompletionDevelopmentService({ completionService }).completeCourse(loadedPython);
    expect(completionService.recordLessonCompletion).toHaveBeenCalledTimes(109);
  });

  it('reports a bounded lesson identity and category and stops on first failure', async () => {
    const error = Object.assign(new Error('raw internal details should not be shown'), { code: 'development/identity-mismatch' });
    const completionService = { recordLessonCompletion: vi.fn().mockRejectedValue(error) };
    await expect(new TrustedCompletionDevelopmentService({ completionService }).completeCourse(loadedPython)).rejects.toMatchObject({
      lessonId: 'lesson-1-1-introduction-to-python', code: 'development/identity-mismatch',
      message: expect.not.stringContaining('raw internal details'),
    });
    expect(completionService.recordLessonCompletion).toHaveBeenCalledOnce();
  });
});
