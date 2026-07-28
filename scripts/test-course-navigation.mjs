import assert from 'node:assert/strict';
import { createCourseNavigation } from '../src/course/courseNavigation.js';

const lesson = (id, status = 'available', navigation) => ({
  id,
  title: id,
  status,
  navigation,
  blocks: [{ id: `${id}-block`, type: 'paragraph', content: id }],
});

const course = {
  navigation: { skipLockedLessons: true },
  modules: [
    {
      id: 'module-one',
      lessons: [
        lesson('lesson-one'),
        lesson('lesson-locked', 'locked'),
        lesson('lesson-two', 'available', { nextLessonId: 'lesson-branch' }),
      ],
    },
    {
      id: 'module-two',
      lessons: [
        lesson('lesson-branch', 'available', {
          branches: [
            {
              id: 'path-a',
              label: 'Path A',
              targetLessonId: 'lesson-a',
              isDefault: true,
            },
            {
              id: 'path-b',
              label: 'Path B',
              targetLessonId: 'lesson-b',
            },
          ],
        }),
        lesson('lesson-a'),
        lesson('lesson-b'),
      ],
    },
  ],
};

const navigation = createCourseNavigation(course);

assert.equal(navigation.getState('lesson-one').nextLesson.id, 'lesson-two');
assert.equal(navigation.getState('lesson-two').nextLesson.id, 'lesson-branch');
assert.equal(navigation.getState('lesson-branch').nextLesson.id, 'lesson-a');
assert.deepEqual(
  navigation.getState('lesson-branch').nextLessonOptions.map((option) => option.lesson.id),
  ['lesson-a', 'lesson-b'],
);
assert.equal(navigation.getState('lesson-a').previousLesson.id, 'lesson-branch');
assert.equal(navigation.canNavigateTo('lesson-locked'), false);
assert.equal(navigation.canNavigateTo('lesson-b'), true);

console.log('Course navigation tests passed.');
