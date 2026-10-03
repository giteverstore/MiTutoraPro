import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createProjectAIContext } from '../../src/projects/ai/projectAIContext';
import { ProjectAIClient, validateProjectAIResponse } from '../../src/projects/ai/ProjectAIClient';
import { ProjectContextualAI } from '../../src/projects/components/ProjectContextualAI';
import { explainProjectMentor } from '../../server/ai/project/projectMentorHandler';

const project = { id: 'task-manager', title: 'Task Manager', description: 'A CLI project', difficulty: 'Beginner', learningObjectives: ['Model tasks'] };
const checkpoint = { id: 'model', title: 'Task Representation', objective: 'Represent one task', requirements: ['Store a title'] };
const context = (type, selectedContent, extra = {}) => createProjectAIContext({ project, checkpoint, languageId: 'javascript', selectionType: type, selectedContent, guideContext: 'Keep title and completed together.', ...extra });

describe('Projects contextual AI mentor', () => {
  it.each([
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

  it('generates questions, answers a selection, and offers contextual follow-ups without a composer', async () => {
    const client = { generateQuestions: vi.fn().mockResolvedValue({ questions: [{ id: 'why', label: 'Why is this needed?', intent: 'understand' }, { id: 'bug', label: 'Where is the bug?', intent: 'debug' }, { id: 'hint', label: 'Give me a hint', intent: 'hint' }] }), answer: vi.fn().mockResolvedValue({ answer: 'Inspect where the task is stored before changing more code.', followUps: [{ id: 'more', label: 'Give me a more specific hint', intent: 'stronger-hint' }] }) };
    render(<ProjectContextualAI context={context('user_code', 'tasks.push(task)', { currentFile: { path: 'index.js', content: 'tasks.push(task)' } })} client={client} accessTier="PREMIUM" />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));
    expect(screen.getByRole('status')).toHaveTextContent(/generating/i);
    fireEvent.click(await screen.findByRole('button', { name: 'Give me a hint' }));
    expect(screen.getByRole('status')).toHaveTextContent(/focused answer/i);
    expect(await screen.findByText(/Inspect where the task is stored/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Give me a more specific hint' })).toBeInTheDocument();
  });

  it('shows provider and quota failures as friendly panel errors', async () => {
    const client = { generateQuestions: vi.fn().mockRejectedValue(new Error('AI usage limit reached.')) };
    render(<ProjectContextualAI context={context('guide_text', 'Represent a task')} client={client} accessTier="PREMIUM" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));
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
