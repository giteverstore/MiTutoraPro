import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProjectAIContext } from '../../src/projects/ai/projectAIContext';
import { ProjectAIClient, validateProjectAIResponse } from '../../src/projects/ai/ProjectAIClient';
import { ProjectContextualAIConversation as ProjectContextualAI } from '../../src/projects/components/ProjectContextualAIConversation';
import { explainProjectMentor } from '../../server/ai/project/projectMentorHandler';

const project = { id: 'task-manager', title: 'Task Manager', description: 'A CLI project', difficulty: 'Beginner', learningObjectives: ['Model tasks'] };
const checkpoint = { id: 'model', title: 'Task Representation', objective: 'Represent one task', requirements: ['Store a title'] };
const context = (type, selectedContent, extra = {}) => createProjectAIContext({ project, checkpoint, languageId: 'javascript', selectionType: type, selectedContent, guideContext: 'Keep title and completed together.', ...extra });

afterEach(cleanup);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

describe('Projects contextual AI mentor', () => {
  it('preserves loaded turns through suggestion generation and appends an answer without truncating history', async () => {
    const oldItems = Array.from({ length: 4 }, (_, index) => [
      { id: `old-${index}-user`, requestId: `old-${index}`, role: 'user', text: `Old question ${index}`, createdAt: index * 2 },
      { id: `old-${index}-assistant`, requestId: `old-${index}`, role: 'assistant', response: { answer: `Old answer ${index}` }, createdAt: index * 2 + 1 },
    ]).flat();
    const client = {
      history: vi.fn().mockResolvedValue({ items: oldItems, nextCursor: null }),
      generateQuestions: vi.fn().mockResolvedValue({ questions: [{ id: 'why', label: 'Why?', intent: 'understand' }] }),
      answer: vi.fn().mockResolvedValue({ answer: 'New answer', followUps: [] }),
    };
    render(<ProjectContextualAI context={context('checkpoint_context', 'Represent one task')} client={client} accessTier="PREMIUM" />);
    await screen.findByText('Old answer 3');
    fireEvent.click(screen.getByRole('button', { name: 'Suggest questions' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Why?' }));
    await screen.findByText('New answer');

    expect(screen.getAllByLabelText('You')).toHaveLength(5);
    expect(screen.getAllByLabelText('AI Mentor')).toHaveLength(5);
    expect(client.answer.mock.calls[0][2]).toHaveLength(3);
    expect(client.answer.mock.calls[0][3].requestId).toBeTruthy();
  });

  it('merges history that arrives during an answer instead of replacing either side', async () => {
    const history = deferred();
    const answer = deferred();
    const client = {
      history: vi.fn(() => history.promise),
      generateQuestions: vi.fn().mockResolvedValue({ questions: [{ id: 'why', label: 'Why?', intent: 'understand' }] }),
      answer: vi.fn(() => answer.promise),
    };
    render(<ProjectContextualAI context={context('checkpoint_context', 'Represent one task')} client={client} accessTier="PREMIUM" />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest questions' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Why?' }));
    history.resolve({ items: [
      { id: 'history-user', requestId: 'history', role: 'user', text: 'Historical question', createdAt: 1 },
      { id: 'history-assistant', requestId: 'history', role: 'assistant', response: { answer: 'Historical answer' }, createdAt: 2 },
    ], nextCursor: null });
    await screen.findByText('Historical answer');
    answer.resolve({ answer: 'Live answer', followUps: [] });
    await screen.findByText('Live answer');

    expect(screen.getByText('Historical question')).toBeInTheDocument();
    expect(screen.getAllByLabelText('You')).toHaveLength(2);
    expect(screen.getAllByLabelText('AI Mentor')).toHaveLength(2);
  });

  it('keeps Project history failures non-blocking', async () => {
    const client = { history: vi.fn().mockRejectedValue(new Error('unavailable')), generateQuestions: vi.fn(), answer: vi.fn() };
    render(<ProjectContextualAI context={context('checkpoint_context', 'Represent one task')} client={client} accessTier="PREMIUM" />);
    expect(await screen.findByText(/Previous messages couldn't be loaded/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ask AI Mentor' })).toBeEnabled();
  });

  it.each([
    ['checkpoint_context', 'Represent one task', {}],
    ['guide_text', 'Each task needs a title.', {}],
    ['guide_code', 'const task = { title };', {}],
    ['user_code', 'tasks.push(task)', { currentFile: { path: 'index.js', content: 'x'.repeat(7000) + 'tasks.push(task)' + 'y'.repeat(7000) } }],
    ['terminal_output', 'TypeError: failed', { terminal: { command: 'node index.js', status: 'failed', stream: 'stderr', recentOutput: 'z'.repeat(8000) }, currentFile: { path: 'index.js', content: 'console.log(task)' } }],
  ])('assembles bounded %s context with language, checkpoint, and difficulty', (type, selection, extra) => {
    const value = context(type, selection, extra);
    expect(value).toMatchObject({ languageId: 'javascript', selectionType: type, project: { difficulty: 'Beginner' }, checkpoint: { id: 'model' } });
    if (value.currentFile) expect(value.currentFile.content.length).toBeLessThan(12_100);
    if (value.terminal) expect(value.terminal.recentOutput.length).toBeLessThan(6_100);
    expect(JSON.stringify(value)).not.toContain('account');
  });

  it('validates structured question and answer responses and rejects malformed output', () => {
    const questions = { operation: 'project-questions', questions: [1, 2, 3, 4, 5].map((id) => ({ id: String(id), label: `Question ${id}`, intent: 'understand' })) };
    expect(validateProjectAIResponse(questions, 'project-questions')).toBe(true);
    expect(validateProjectAIResponse({ operation: 'project-questions', questions: [] }, 'project-questions')).toBe(false);
    expect(validateProjectAIResponse({ operation: 'project-answer', answer: 'Hint', followUps: [] }, 'project-answer')).toBe(true);
  });

  it('supports direct typed questions and optional contextual follow-ups in one composer history', async () => {
    const client = { generateQuestions: vi.fn().mockResolvedValue({ questions: [{ id: 'why', label: 'Why is this needed?', intent: 'understand' }, { id: 'bug', label: 'Where is the bug?', intent: 'debug' }, { id: 'hint', label: 'Give me a hint', intent: 'hint' }] }), answer: vi.fn().mockResolvedValueOnce({ answer: 'Inspect where the task is stored before changing more code.', followUps: [{ id: 'more', label: 'Give me a more specific hint', intent: 'stronger-hint' }] }).mockResolvedValueOnce({ answer: 'Trace the array mutation in the add function.', followUps: [] }).mockResolvedValueOnce({ answer: 'It changes the shared task list.', followUps: [] }) };
    render(<ProjectContextualAI context={context('user_code', 'tasks.push(task)', { currentFile: { path: 'index.js', content: 'tasks.push(task)' } })} client={client} accessTier="PREMIUM" />);
    const composer = screen.getByRole('textbox', { name: 'Ask AI Mentor' });
    expect(screen.getByRole('region', { name: 'AI Mentor conversation' })).toBeInTheDocument();
    expect(client.generateQuestions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest questions' }));
    expect(screen.getByRole('status')).toHaveTextContent(/preparing questions/i);
    fireEvent.click(await screen.findByRole('button', { name: 'Give me a hint' }));
    expect(screen.getByRole('status')).toHaveTextContent(/focused answer/i);
    expect(await screen.findByText(/Inspect where the task is stored/)).toBeInTheDocument();
    expect(screen.getByLabelText('You')).toHaveTextContent('Give me a hint');
    expect(screen.getByLabelText('AI Mentor')).toHaveTextContent(/Inspect where the task is stored/);
    expect(screen.getByRole('button', { name: 'Give me a more specific hint' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Give me a more specific hint' }));
    expect(await screen.findByText(/Trace the array mutation/)).toBeInTheDocument();
    expect(screen.getAllByLabelText('You')).toHaveLength(2);
    expect(screen.getAllByLabelText('AI Mentor')).toHaveLength(2);
    expect(client.answer.mock.calls[1][2]).toHaveLength(1);
    fireEvent.change(composer, { target: { value: 'Why does this mutation matter?' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    await waitFor(() => expect(client.answer).toHaveBeenCalledTimes(3));
    expect(client.answer.mock.calls[2][1]).toMatchObject({ label: 'Why does this mutation matter?', intent: 'learner-question' });
  });

  it('formats Project answers and keeps follow-up suggestions visually separate', async () => {
    const client = {
      answer: vi.fn().mockResolvedValue({
        answer: '## Check the state\n\n- Read `tasks` first\n- Keep the mutation focused\n\n```javascript\nif (ready) {\n  tasks.push(task);\n}\n```',
        followUps: [{ id: 'next', label: 'Show the next check', intent: 'follow-up' }],
      }),
    };
    render(<ProjectContextualAI context={context('checkpoint_context', 'Represent one task')} client={client} accessTier="PREMIUM" />);
    const composer = screen.getByRole('textbox', { name: 'Ask AI Mentor' });
    fireEvent.change(composer, { target: { value: 'How should I update it?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send AI Mentor message' }));

    const answer = await screen.findByLabelText('AI Mentor');
    expect(within(answer).getByRole('heading', { name: 'Check the state' })).toBeInTheDocument();
    expect(within(answer).getByRole('list')).toHaveTextContent('Keep the mutation focused');
    expect(answer.querySelector('pre code')?.textContent).toContain('  tasks.push(task);');
    expect(screen.getByRole('button', { name: 'Show the next check' })).toBeInTheDocument();
  });

  it('does not submit Ask AI selection context and preserves the existing conversation and draft', async () => {
    const client = { generateQuestions: vi.fn().mockResolvedValue({ questions: [{ id: 'hint', label: 'Give me a hint', intent: 'hint' }] }), answer: vi.fn().mockResolvedValue({ answer: 'First context answer.', followUps: [] }) };
    const { rerender } = render(<ProjectContextualAI context={context('guide_text', 'First selection')} client={client} accessTier="PREMIUM" />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest questions' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Give me a hint' }));
    expect(await screen.findByText('First context answer.')).toBeInTheDocument();

    rerender(<ProjectContextualAI context={context('guide_code', 'const second = true;')} client={client} accessTier="PREMIUM" />);
    expect(screen.getByText('First context answer.')).toBeInTheDocument();
    expect(screen.getByText('const second = true;')).toBeInTheDocument();
    const composer = screen.getByRole('textbox', { name: 'Ask AI Mentor' });
    await waitFor(() => expect(composer).toHaveFocus());
    expect(composer).toHaveValue('Explain this selection.');
    expect(composer.value).not.toContain('const second = true;');
    expect(client.generateQuestions).toHaveBeenCalledTimes(1);
    expect(client.answer).toHaveBeenCalledTimes(1);
  });

  it('shows provider and quota failures as friendly panel errors', async () => {
    const client = { generateQuestions: vi.fn().mockRejectedValue(new Error('AI usage limit reached.')) };
    render(<ProjectContextualAI context={context('guide_text', 'Represent a task')} client={client} accessTier="PREMIUM" />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest questions' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('AI usage limit reached.');
  });

  it('preserves the existing provider, feature gate, and quota boundary on the server', async () => {
    const response = { operation: 'project-questions', questions: [1, 2, 3].map((id) => ({ id: String(id), label: `Question ${id}`, intent: 'learn' })) };
    const quotaGuard = { assertAllowed: vi.fn().mockResolvedValue({ maximum: { inputTokens: 12000, outputTokens: 450, costMicros: 1000000 } }), settle: vi.fn().mockResolvedValue(true) };
    const featureGate = { assertEnabled: vi.fn().mockResolvedValue({ state: 'enabled' }) };
    const provider = { explain: vi.fn().mockResolvedValue({ text: JSON.stringify(response), usage: { input_tokens: 100, output_tokens: 50 } }) };
    await expect(explainProjectMentor({ requestType: 'project-questions', context: context('guide_text', 'Represent a task') }, { principal: { uid: 'learner' }, quotaGuard, featureGate, providerFactory: () => provider, pricing: { known: false }, providerTokenConstraints: { inputOverheadTokens: 0, maxInputTokens: 50_000 } })).resolves.toEqual(response);
    expect(featureGate.assertEnabled).toHaveBeenCalled(); expect(quotaGuard.assertAllowed).toHaveBeenCalled(); expect(quotaGuard.settle).toHaveBeenCalled();
    expect(provider.explain.mock.calls[0][0].systemInstruction).toMatch(/Do not answer them/);
  });

  it('accepts a bounded learner-authored project question through the existing answer path', async () => {
    const response = { operation: 'project-answer', answer: 'Start by tracing the task state.', followUps: [] };
    const quotaGuard = { assertAllowed: vi.fn().mockResolvedValue({ maximum: { inputTokens: 12000, outputTokens: 900, costMicros: 1000000 } }), settle: vi.fn().mockResolvedValue(true) };
    const provider = { explain: vi.fn().mockResolvedValue({ text: JSON.stringify(response), usage: { input_tokens: 100, output_tokens: 50 } }) };
    const body = { requestType: 'project-answer', context: context('checkpoint_context', 'Represent one task'), question: { id: 'learner-1', label: 'Why are we using an object here?', intent: 'learner-question' }, conversation: [] };
    await expect(explainProjectMentor(body, { principal: { uid: 'learner' }, quotaGuard, featureGate: { assertEnabled: vi.fn().mockResolvedValue({ state: 'enabled' }) }, providerFactory: () => provider, pricing: { known: false }, providerTokenConstraints: { inputOverheadTokens: 0, maxInputTokens: 50_000 } })).resolves.toEqual(response);
    expect(provider.explain.mock.calls[0][0].userContent).toContain('Why are we using an object here?');
  });

  it('maps malformed provider output to a safe error', async () => {
    const quotaGuard = { assertAllowed: vi.fn().mockResolvedValue({ maximum: { inputTokens: 12_000, outputTokens: 450, costMicros: 1_000_000 } }), settle: vi.fn() };
    await expect(explainProjectMentor({ requestType: 'project-questions', context: context('guide_text', 'Represent a task') }, { principal: { uid: 'learner' }, quotaGuard, featureGate: { assertEnabled: vi.fn() }, providerFactory: () => ({ explain: vi.fn().mockResolvedValue({ text: 'not json', usage: { input_tokens: 4, output_tokens: 3 } }) }), pricing: { known: false }, providerTokenConstraints: { inputOverheadTokens: 0, maxInputTokens: 50_000 } })).rejects.toMatchObject({ code: 'ai/provider-response-invalid' });
    await waitFor(() => expect(quotaGuard.settle).toHaveBeenCalled());
  });

  it('uses the authenticated client endpoint and rejects invalid response bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ operation: 'project-questions', questions: [] }) });
    const client = new ProjectAIClient({ fetchImpl, tokenProvider: async () => 'token' });
    await expect(client.generateQuestions(context('guide_text', 'Represent a task'))).rejects.toMatchObject({ code: 'ai/provider-response-invalid' });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer token');
  });

  it('invokes the browser fetch implementation with the global receiver', async () => {
    const fetchImpl = vi.fn(function () {
      expect(this).toBe(globalThis);
      return Promise.resolve({ ok: true, json: async () => ({ operation: 'project-questions', questions: [1, 2, 3].map((id) => ({ id: String(id), label: `Question ${id}`, intent: 'learn' })) }) });
    });
    const client = new ProjectAIClient({ fetchImpl, tokenProvider: async () => 'firebase-token' });
    await expect(client.generateQuestions(context('guide_text', 'Represent a task'))).resolves.toMatchObject({ operation: 'project-questions' });
  });
});
