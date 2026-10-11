import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CourseStudio } from '../src/content-studio/courses/CourseStudio.jsx';
import { createCourseDraft } from '../src/content-studio/courses/courseAuthoring.js';
import { LocalDraftRepository } from '../src/content-studio/persistence/DraftRepository.js';

vi.mock('../src/content-studio/persistence/CloudDraftRepository.js', () => ({ CloudDraftRepository: class {} }));
vi.mock('../src/publishing/publishingApi.js', () => ({ adminContentRequest: vi.fn() }));

const contentId = 'course-coming-soon-test';
const path = `/content/courses/${contentId}/edit`;
const draftWith = (comingSoon) => {
  const draft = createCourseDraft(contentId);
  return { ...draft, draftRevision: 4, content: { ...draft.content, title: 'Existing Course', description: 'Keep this description.', comingSoon } };
};
const openEditor = (readOnly = false) => render(<CourseStudio path={path} role="CONTENT_EDITOR" readOnly={readOnly} onNavigate={() => {}} />);

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Course Coming Soon metadata control', () => {
  it.each([false, true])('hydrates an existing %s value without writing', async (comingSoon) => {
    const save = vi.spyOn(LocalDraftRepository.prototype, 'save');
    vi.spyOn(LocalDraftRepository.prototype, 'load').mockResolvedValue(draftWith(comingSoon));
    openEditor();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Existing Course'));
    expect(screen.getByRole('checkbox', { name: /Coming Soon/ }).checked).toBe(comingSoon);
    expect(save).not.toHaveBeenCalled();
  });

  it('saves only the Coming Soon change with the existing revision and no publication request', async () => {
    const original = draftWith(false);
    vi.spyOn(LocalDraftRepository.prototype, 'load').mockResolvedValue(original);
    const save = vi.spyOn(LocalDraftRepository.prototype, 'save').mockImplementation(async (document, revision) => ({ ...document, draftRevision: revision + 1 }));
    const fetch = vi.spyOn(globalThis, 'fetch');
    openEditor();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Existing Course'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Coming Soon/ }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const saved = save.mock.calls[0][0];
    expect(saved.draftRevision).toBe(4);
    expect(save.mock.calls[0][1]).toBe(4);
    expect(saved.content).toEqual({ ...original.content, comingSoon: true });
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Coming Soon/ })).toBeChecked());
    fireEvent.click(screen.getByRole('checkbox', { name: /Coming Soon/ }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][1]).toBe(5);
    expect(save.mock.calls[1][0].content).toEqual(original.content);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the hydrated value but prevents reviewers from changing it', async () => {
    const save = vi.spyOn(LocalDraftRepository.prototype, 'save');
    vi.spyOn(LocalDraftRepository.prototype, 'load').mockResolvedValue(draftWith(true));
    openEditor(true);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Existing Course'));
    expect(screen.getByRole('checkbox', { name: /Coming Soon/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Coming Soon/ })).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });
});
