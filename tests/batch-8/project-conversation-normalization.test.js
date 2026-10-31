import { describe, expect, it } from 'vitest';
import { projectProviderConversation, reconcileProjectTurns } from '../../src/projects/ai/projectConversation.js';
import { createProjectMentorProviderRequest, normalizeProjectMentorRequest } from '../../server/ai/project/projectMentorRequest.js';

const request = (conversation = []) => ({
  requestType: 'project-answer',
  context: {
    project: { id: 'bingo', title: 'Bingo', description: '', difficulty: 'Beginner', learningObjectives: [] },
    checkpoint: { id: 'setup', title: 'Setup', objective: 'Create the card', requirements: [] },
    languageId: 'python', selectionType: 'checkpoint_context', selectedContent: 'Create the card',
  },
  question: { id: 'learner-2', label: 'What is a class?', intent: 'learner-question' },
  conversation,
});

describe('Project conversation normalization', () => {
  it('reconciles split history pages by request ID and excludes partial turns from provider context', () => {
    const latest = [
      { id: 'r3-assistant', requestId: 'r3', role: 'assistant', response: { answer: 'answer 3' }, createdAt: 6 },
      { id: 'r4-user', requestId: 'r4', role: 'user', text: 'question 4', createdAt: 7 },
      { id: 'r4-assistant', requestId: 'r4', role: 'assistant', response: { answer: 'answer 4' }, createdAt: 8 },
      { id: 'r5-user', requestId: 'r5', role: 'user', text: 'question 5', createdAt: 9 },
      { id: 'r5-assistant', requestId: 'r5', role: 'assistant', response: { answer: 'answer 5' }, createdAt: 10 },
    ];
    const first = reconcileProjectTurns([], latest);
    expect(first.find((turn) => turn.id === 'r3')).toMatchObject({ id: 'r3', answer: 'answer 3' });
    expect(first.find((turn) => turn.id === 'r3')).not.toHaveProperty('question');
    expect(projectProviderConversation(first)).toEqual([
      { question: 'question 4', answer: 'answer 4' },
      { question: 'question 5', answer: 'answer 5' },
    ]);

    const older = [
      { id: 'r1-user', requestId: 'r1', role: 'user', text: 'question 1', createdAt: 1 },
      { id: 'r1-assistant', requestId: 'r1', role: 'assistant', response: { answer: 'answer 1' }, createdAt: 2 },
      { id: 'r2-user', requestId: 'r2', role: 'user', text: 'question 2', createdAt: 3 },
      { id: 'r2-assistant', requestId: 'r2', role: 'assistant', response: { answer: 'answer 2' }, createdAt: 4 },
      { id: 'r3-user', requestId: 'r3', role: 'user', text: 'question 3', createdAt: 5 },
    ];
    const reconciled = reconcileProjectTurns(first, older);
    expect(reconciled.find((turn) => turn.id === 'r3')).toMatchObject({ question: 'question 3', answer: 'answer 3' });
    expect(projectProviderConversation(reconciled)).toEqual([
      { question: 'question 3', answer: 'answer 3' },
      { question: 'question 4', answer: 'answer 4' },
      { question: 'question 5', answer: 'answer 5' },
    ]);
  });

  it('accepts valid long answers while preserving individual and aggregate bounds', () => {
    const answer = 'x'.repeat(4_500);
    const turns = reconcileProjectTurns([], [{ id: 'live', requestId: 'live', question: 'Explain it', answer, createdAt: 1 }]);
    expect(projectProviderConversation(turns)).toEqual([{ question: 'Explain it', answer }]);
    expect(projectProviderConversation([...turns, { id: 'too-long', requestId: 'too-long', question: 'q', answer: 'x'.repeat(5_001) }])).toEqual([{ question: 'Explain it', answer }]);
  });

  it('allows an empty previous conversation', () => {
    expect(normalizeProjectMentorRequest(request()).conversation).toEqual([]);
  });

  it('accepts a previously valid Project answer through 5000 characters', () => {
    const answer = 'x'.repeat(5_000);
    expect(normalizeProjectMentorRequest(request([{ question: 'How do I start?', answer }])).conversation[0]).toEqual({ question: 'How do I start?', answer });
    expect(() => normalizeProjectMentorRequest(request([{ question: 'How do I start?', answer: `${answer}x` }]))).toThrow('A valid previous answer is required.');
  });

  it('requests restrained content-adaptive Markdown without forcing templates', () => {
    const provider = createProjectMentorProviderRequest(normalizeProjectMentorRequest(request()));
    expect(provider.systemInstruction).toMatch(/simple questions.*one or two paragraphs/i);
    expect(provider.systemInstruction).toMatch(/paragraph breaks/i);
    expect(provider.systemInstruction).toMatch(/numbered lists.*ordered procedures/i);
    expect(provider.systemInstruction).toMatch(/bullet lists.*collections/i);
    expect(provider.systemInstruction).toMatch(/inline backticks.*identifiers/i);
    expect(provider.systemInstruction).toMatch(/fenced code blocks.*multiline/i);
    expect(provider.systemInstruction).toMatch(/short headings only when/i);
    expect(provider.systemInstruction).toMatch(/do not turn every answer into sections/i);
  });
});
