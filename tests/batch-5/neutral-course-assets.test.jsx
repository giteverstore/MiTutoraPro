import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { validateCourseContent } from '../../shared/content/validation.js';
import { adaptCanonicalCourse } from '../../src/content/repositories/CanonicalPublishedRepository.js';
import { mapPublishedCourse } from '../../src/home/canonicalCourseCatalog.js';
import { ImageBlock } from '../../src/components/blocks/ImageBlock.jsx';
import { ExpectedOutputBlock } from '../../src/components/blocks/ExpectedOutputBlock.jsx';
import { ListBlock } from '../../src/components/blocks/ListBlock.jsx';
import { resolveBlockComponent } from '../../src/components/blockRegistry.js';
import { ADMIN_PUBLIC_CONTENT_DETAIL_ROUTE } from '../../vercel.mjs';

function documentWith(blocks) {
  return {
    contentId: 'git-course', version: 3, locale: 'en', metadata: {},
    content: {
      courseId: 'git-course', slug: 'git-course', title: 'Git Course', description: 'Learn Git.',
      language: 'none', difficulty: 'Beginner', estimatedMinutes: 60, prerequisites: [],
      learningOutcomes: ['Understand Git.'], tags: ['Developer tools'], defaultLessonId: 'lesson-one',
      modules: [{ id: 'module-one', order: 1, title: 'First module', description: 'Introduction.', lessons: [{
        id: 'lesson-one', order: 1, number: '1', title: 'First lesson', summary: 'Introduction.',
        status: 'available', estimatedMinutes: 10, tags: [], blocks,
      }] }],
    },
  };
}

describe('neutral canonical Course delivery', () => {
  it('accepts language none and rejects executable compiler blocks', () => {
    const document = documentWith([{ id: 'paragraph-one', type: 'paragraph', content: 'Hello.', format: 'plain' }]);
    expect(validateCourseContent(document.content)).toMatchObject({ valid: true });
    document.content.modules[0].lessons[0].blocks.push({ id: 'compiler-one', type: 'compiler', language: 'python' });
    expect(validateCourseContent(document.content).errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'compiler.unavailable' })]));
  });

  it('pins private image URLs to the exact published version without a signed URL', () => {
    const document = documentWith([{ id: 'image-one', type: 'image', assetId: 'asset-11111111-1111-4111-8111-111111111111', alt: 'Branches', caption: 'Git branches' }]);
    const course = adaptCanonicalCourse(document);
    const image = course.modules[0].lessons[0].blocks[0];
    expect(course).toMatchObject({ language: 'none', compilerEnabled: false });
    expect(image.src).toBe('/api/admin-content/public/assets/git-course/3/asset-11111111-1111-4111-8111-111111111111');
    expect(image).toMatchObject({ alt: 'Branches', caption: 'Git branches' });
    expect(image.src).not.toContain('Signature=');
    expect(image.src).toMatch(new RegExp(ADMIN_PUBLIC_CONTENT_DETAIL_ROUTE.src));
    render(<ImageBlock {...image} />);
    expect(screen.getByRole('img', { name: 'Branches' })).toHaveAttribute('src', image.src);
  });

  it('preserves legacy image URLs and uses the non-programming catalog group', () => {
    const document = documentWith([{ id: 'image-one', type: 'image', src: '/assets/legacy.png', alt: 'Legacy' }]);
    expect(adaptCanonicalCourse(document).modules[0].lessons[0].blocks[0].src).toBe('/assets/legacy.png');
    expect(mapPublishedCourse({ contentId: 'git-course', activeVersion: 3, metadata: { language: 'none', topic: 'Developer tools' } })).toMatchObject({ filter: 'Developer tools', kind: 'domains' });
  });

  it('renders the existing list and expected-output blocks in a neutral Course', () => {
    expect(resolveBlockComponent('list')).toBe(ListBlock);
    expect(resolveBlockComponent('expected-output')).toBe(ExpectedOutputBlock);
    render(<ExpectedOutputBlock output="git status" />);
    expect(screen.getByText('git status')).toBeInTheDocument();
    render(<ListBlock style="ordered" items={['Stage', 'Commit']} />);
    expect(screen.getByText('Stage').closest('ol')).toBeInTheDocument();
  });
});
