import { describe, expect, it } from 'vitest';
import { assertLimit, contentDepth, utf8ByteLength, validateCourseComplexity, validatePracticeComplexity } from '../../src/content/validation/contentLimits';

const lesson = (blocks) => ({ id: 'lesson-one', blocks });
const course = (blocks) => ({ modules: [{ id: 'module-one', lessons: [lesson(blocks)] }] });
const permissiveCourseLimits = { maxManifestBytes: 1000, maxCourseBytes: 10000, maxModuleBytes: 9000, maxLessonBytes: 8000, maxLessonsPerModule: 2, maxBlocksPerLesson: 2, maxBlockDepth: 6, maxTextCharacters: 20, maxCodeCharacters: 20, maxQuizOptions: 2, maxExamples: 2 };
const permissivePracticeLimits = { maxQuestionBytes: 10000, maxMetadataBytes: 1000, maxStatementCharacters: 20, maxStarterCodeCharacters: 20, maxCompilerConfigurationBytes: 1000, maxExamples: 2, maxOptions: 2, maxTests: 2, maxDepth: 8 };

describe('content safety limits', () => {
  it('uses exact UTF-8 byte counts at and over a boundary', () => {
    expect(utf8ByteLength('é')).toBe(2);
    expect(() => assertLimit(2, 2, 'payload')).not.toThrow();
    expect(() => assertLimit(3, 2, 'payload')).toThrow(/exceeds the limit/);
  });

  it('accepts course collections at their limits and rejects one over', () => {
    const atLimit = course([{ id: 'a', type: 'quiz', options: [{}, {}], text: '12345' }, { id: 'b', type: 'paragraph', content: '12345' }]);
    expect(() => validateCourseComplexity(atLimit, permissiveCourseLimits)).not.toThrow();
    expect(() => validateCourseComplexity(course([...atLimit.modules[0].lessons[0].blocks, { id: 'c' }]), permissiveCourseLimits)).toThrow(/block count/);
    expect(() => validateCourseComplexity(course([{ id: 'a', type: 'quiz', options: [{}, {}, {}] }]), permissiveCourseLimits)).toThrow(/option count/);
  });

  it('rejects oversized text, code, lesson, module, course, and excessive nesting', () => {
    expect(() => validateCourseComplexity(course([{ id: 'a', type: 'paragraph', content: 'x'.repeat(21) }]), permissiveCourseLimits)).toThrow(/text field/);
    expect(() => validateCourseComplexity(course([{ id: 'a', type: 'code', code: 'x'.repeat(21) }]), permissiveCourseLimits)).toThrow(/code field/);
    expect(() => validateCourseComplexity(course([{ id: 'a', type: 'paragraph', content: { nested: { deeply: { value: 'x' } } } }]), { ...permissiveCourseLimits, maxBlockDepth: 3 })).toThrow(/depth/);
    for (const key of ['maxLessonBytes', 'maxModuleBytes', 'maxCourseBytes']) {
      expect(() => validateCourseComplexity(course([]), { ...permissiveCourseLimits, [key]: 1 })).toThrow(/exceeds/);
    }
  });

  it('bounds pathological Practice examples, options, tests, strings, depth, and bytes', () => {
    const atLimit = { id: 'question', blocks: [{ type: 'compiler', starterCode: '12345', examples: [{}, {}], options: [{}, {}], testCases: [{}, {}] }] };
    expect(() => validatePracticeComplexity(atLimit, permissivePracticeLimits)).not.toThrow();
    expect(() => validatePracticeComplexity({ ...atLimit, blocks: [{ ...atLimit.blocks[0], examples: [{}, {}, {}] }] }, permissivePracticeLimits)).toThrow(/example count/);
    expect(() => validatePracticeComplexity({ ...atLimit, blocks: [{ ...atLimit.blocks[0], starterCode: 'x'.repeat(21) }] }, permissivePracticeLimits)).toThrow(/code field/);
    expect(() => validatePracticeComplexity({ ...atLimit, blocks: [{ ...atLimit.blocks[0], options: [{}, {}, {}] }] }, permissivePracticeLimits)).toThrow(/option count/);
    expect(() => validatePracticeComplexity({ id: 'question', nested: { a: { b: { c: {} } } } }, { ...permissivePracticeLimits, maxDepth: 2 })).toThrow(/depth/);
    expect(() => validatePracticeComplexity(atLimit, { ...permissivePracticeLimits, maxQuestionBytes: 1 })).toThrow(/exceeds/);
    expect(() => validatePracticeComplexity(null, permissivePracticeLimits)).toThrow();
    expect(contentDepth({ a: [{ b: true }] })).toBe(3);
  });
});
