import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CoursePreview } from '../src/content-studio/courses/CourseStudio.jsx';
import { createCourseDraft } from '../src/content-studio/courses/courseAuthoring.js';

vi.mock('../src/publishing/AssetsPage.jsx', () => ({
  AssetPreview: ({ asset, alt }) => <img alt={alt} data-asset-id={asset.assetId} src="blob:local-test" />,
}));
vi.mock('../src/content-studio/persistence/CloudDraftRepository.js', () => ({ CloudDraftRepository: class {} }));
vi.mock('../src/publishing/publishingApi.js', () => ({ publishingApi: {} }));

describe('neutral Course Admin preview', () => {
  it('uses the registered asset ID while preserving alt text and caption', () => {
    const course = createCourseDraft('git-test').content;
    course.language = 'none';
    course.modules[0].lessons[0].blocks = [{ id: 'diagram', type: 'image', assetId: 'asset-11111111-1111-4111-8111-111111111111', alt: 'Branches diverge', caption: 'Branch diagram' }];
    render(<CoursePreview course={course} />);
    expect(screen.getByRole('img', { name: 'Branches diverge' })).toHaveAttribute('data-asset-id', course.modules[0].lessons[0].blocks[0].assetId);
    expect(screen.getByText('Branch diagram')).toBeInTheDocument();
  });

  it('does not show an unrelated image when a reference is absent', () => {
    const course = createCourseDraft('git-test').content;
    course.modules[0].lessons[0].blocks = [{ id: 'diagram', type: 'image', alt: 'Missing image' }];
    const preview = within(render(<CoursePreview course={course} />).container);
    expect(preview.getByRole('alert')).toHaveTextContent('Image asset unavailable');
    expect(preview.queryByRole('img')).not.toBeInTheDocument();
  });
});
