import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { resolveAdminRoute } from '../src/adminRoutes.js';
import { CoursePreview } from '../src/content-studio/courses/CourseStudio.jsx';
import { createCourseDraft, newCourseLesson, newCourseModule, reindexCourse, validateCourseDraft } from '../src/content-studio/courses/courseAuthoring.js';
import { PracticePreview } from '../src/content-studio/practice/PracticeStudio.jsx';
import { createPracticeDraft, validatePracticeDraft } from '../src/content-studio/practice/practiceAuthoring.js';
import { createChallengeDraft, validateChallengeDraft } from '../src/content-studio/challenges/challengeAuthoring.js';
import { createMiniCourseFixture } from '../../../tests/content-contracts/fixtures.js';

const previewManager = vi.hoisted(() => ({ execute: vi.fn(), validateOutput: vi.fn(), dispose: vi.fn() }));
vi.mock('../src/content-studio/projects/adminPreviewCompilerManager.js', () => ({ createAdminPreviewCompilerManager: () => previewManager }));
vi.mock('../src/content-studio/practice/AdminPracticeMonacoEditor.jsx', () => ({
  default: ({ value, onChange }) => <label><span>Code for preview run</span><textarea value={value} onChange={(event) => onChange(event.target.value)} /></label>,
}));

describe('Phase 8 Admin authoring', () => {
  it.each(['/content/courses', '/content/courses/new', '/content/courses/python/edit'])('resolves Course Studio route %s', (path) => expect(resolveAdminRoute(path)?.path).toBe('/content/courses'));
  it.each(['/content/practice', '/content/practice/new', '/content/practice/hello/edit'])('resolves Practice Studio route %s', (path) => expect(resolveAdminRoute(path)?.path).toBe('/content/practice'));
  it.each(['/content/challenges', '/content/challenges/new', '/content/challenges/hello/edit'])('resolves Challenge Studio route %s', (path) => expect(resolveAdminRoute(path)?.path).toBe('/content/challenges'));
  it('creates stable ordered Course hierarchy and validates authored changes', () => {
    const draft = createCourseDraft('mini'); const second = newCourseModule(2); second.lessons.push(newCourseLesson(2)); draft.content.modules = reindexCourse([second, draft.content.modules[0]]);
    expect(draft.content.modules.map(({ order }) => order)).toEqual([1, 2]);
    expect(validateCourseDraft(draft).valid).toBe(true);
  });
  it('validates Practice expected-output authoring without executable validators', () => expect(validatePracticeDraft(createPracticeDraft('hello')).valid).toBe(true));
  it('validates Challenge expected-output authoring without executable validators', () => expect(validateChallengeDraft(createChallengeDraft('hello')).valid).toBe(true));
  it('renders ephemeral Course and Practice previews', () => {
    const course = createCourseDraft('mini').content; const { unmount } = render(<CoursePreview course={course} />);
    expect(screen.getByText('No learner progress is persisted from Admin Preview.')).toBeInTheDocument(); unmount();
    render(<PracticePreview question={createPracticeDraft('hello').content} />);
    expect(screen.getByRole('button', { name: 'Verify output' })).toBeInTheDocument();
    expect(screen.getByText('Preview does not persist learner completion.')).toBeInTheDocument();
  });
  it('navigates Course modules and renders quiz, expected output, and compiler configuration', () => {
    const course = createMiniCourseFixture().content;
    const preview = within(render(<CoursePreview course={course} />).container);
    expect(preview.getByText('Print a greeting.')).toBeInTheDocument();
    expect(preview.getByText('Hello', { selector: 'code' })).toBeInTheDocument();
    fireEvent.click(within(preview.getByRole('navigation', { name: 'Preview modules' })).getByRole('button', { name: 'Quick quiz' }));
    fireEvent.click(preview.getByLabelText('print()'));
    fireEvent.click(preview.getByRole('button', { name: 'Check answer' }));
    expect(preview.getByRole('status')).toHaveTextContent('Correct answer.');
    fireEvent.click(preview.getByRole('button', { name: 'Next lesson' }));
    expect(preview.getByText('print(10 + 20)', { selector: 'code' })).toBeInTheDocument();
    expect(preview.getByText('Expected output: 30')).toBeInTheDocument();
    fireEvent.click(preview.getByRole('button', { name: 'Previous lesson' }));
    expect(preview.getByText('Which function prints output?')).toBeInTheDocument();
  });
  it('runs Practice code then verifies only captured output, without persisting completion', async () => {
    const question = createPracticeDraft('hello').content;
    question.starterCode = 'print("Hello")';
    question.verification.expectedOutput = 'Hello';
    previewManager.execute.mockResolvedValueOnce({ status: 'success', stdout: 'Wrong\n' }).mockResolvedValueOnce({ status: 'success', stdout: 'Hello\n' });
    previewManager.validateOutput.mockReturnValueOnce(false).mockReturnValueOnce(true);
    const preview = within(render(<PracticePreview question={question} />).container);
    fireEvent.click(preview.getByRole('button', { name: 'Run code' }));
    await waitFor(() => expect(preview.getByLabelText('Execution output')).toHaveValue('Wrong\n'));
    fireEvent.click(preview.getByRole('button', { name: 'Verify output' }));
    expect(preview.getByRole('status')).toHaveTextContent('does not match');
    fireEvent.change(preview.getByLabelText('Code for preview run'), { target: { value: 'print("Hello")' } });
    fireEvent.click(preview.getByRole('button', { name: 'Run code' }));
    await waitFor(() => expect(preview.getByLabelText('Execution output')).toHaveValue('Hello\n'));
    fireEvent.click(preview.getByRole('button', { name: 'Verify output' }));
    expect(preview.getByRole('status')).toHaveTextContent('Accepted');
    expect(previewManager.execute).toHaveBeenCalledWith(expect.objectContaining({ language: 'python', source: 'print("Hello")' }));
    expect(previewManager.validateOutput).toHaveBeenCalledWith(expect.objectContaining({ expectedOutput: 'Hello', programOutput: 'Hello\n', validatorType: 'normalized-lines' }));
  });
});
