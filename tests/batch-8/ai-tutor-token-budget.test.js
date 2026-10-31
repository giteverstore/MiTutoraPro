import { describe, expect, it } from 'vitest';
import { normalizeTutorRequest } from '../../server/ai/tutor/tutorRequest.js';
import { createTutorProviderRequest } from '../../server/ai/tutor/tutorPrompt.js';
import { normalizeProviderUsage } from '../../server/ai/tutor/tutorUsage.js';
import { createTutorTelemetryEvent } from '../../server/ai/tutor/tutorTelemetry.js';
import { normalizeProjectMentorRequest, createProjectMentorProviderRequest } from '../../server/ai/project/projectMentorRequest.js';

const lesson = { activityType: 'lesson', solutionPolicy: 'hints-only', maximumHintLevel: 1 };
const context = (learnerMessage, conversation = [], extra = {}) => normalizeTutorRequest({
  requestType: 'explain-full-code', language: 'python', code: 'i = 0\nwhile i < 5:\n    print(i)',
  compilerStatus: 'ready', lessonContext: 'Python loops', learnerMessage, conversation, ...extra,
}, { activityPolicy: lesson });

describe('AI Tutor token budgets', () => {
  it('keeps a stable cache-friendly system prefix across request modes', () => {
    const greeting = createTutorProviderRequest(context('Hi')).systemInstruction;
    const answer = createTutorProviderRequest(context('Just give me the complete code')).systemInstruction;
    expect(greeting.split('TRUSTED REQUEST SETTINGS:')[0]).toBe(answer.split('TRUSTED REQUEST SETTINGS:')[0]);
    expect(greeting).not.toMatch(/timestamp|random/i);
  });

  it('bounds history by turn count and 6000 characters, trimming oldest pairs first', () => {
    const conversation = [
      { question: 'old', answer: 'a'.repeat(2_500) },
      { question: 'middle', answer: 'b'.repeat(2_500) },
      { question: 'newest', answer: 'c'.repeat(2_500) },
    ];
    const normalized = context('I still do not understand', conversation);
    expect(normalized.conversation).toHaveLength(2);
    expect(normalized.conversation.map((turn) => turn.question)).toEqual(['middle', 'newest']);
    expect(normalized.conversation.reduce((total, turn) => total + turn.question.length + turn.answer.length, 0)).toBeLessThanOrEqual(6_000);
  });

  it('always retains the latest learner message independently of history trimming', () => {
    const latest = 'Just give me the complete code';
    const request = createTutorProviderRequest(context(latest, Array.from({ length: 3 }, (_, index) => ({ question: `q${index}`, answer: 'x'.repeat(4_000) }))));
    const data = JSON.parse(request.userContent.split('\n').slice(1).join('\n'));
    expect(data.learnerMessage).toBe(latest);
    expect(data.directAnswerRequested).toBe(true);
  });

  it('retains explicit code and compiler-output request caps', () => {
    expect(() => context('Help', [], { code: 'x'.repeat(50_001) })).toThrow(/too large/i);
    expect(() => context('Help', [], { compilerEvidence: { source: 'print(1)', sourceHash: 'x', language: 'python', status: 'failed', output: 'x'.repeat(12_001) } })).toThrow(/too large/i);
  });

  it('uses intent-aware output budgets without constraining explicit solutions', () => {
    expect(createTutorProviderRequest(context('Hi')).targetResponseTokens).toBe(400);
    expect(createTutorProviderRequest(context('Hi')).maxProviderTokens).toBe(400);
    expect(createTutorProviderRequest(context('What does len() do?')).targetResponseTokens).toBe(700);
    expect(createTutorProviderRequest(context('Just give me the complete code')).targetResponseTokens).toBe(2_400);
    expect(createTutorProviderRequest(context('Just give me the complete code')).maxProviderTokens).toBe(2_400);
  });

  it('sends only tutoring-relevant Project metadata and uses bounded output budgets', () => {
    const normalized = normalizeProjectMentorRequest({
      requestType: 'project-answer',
      context: { project: { id: 'bingo', title: 'Bingo', description: 'decorative description', difficulty: 'Beginner', learningObjectives: ['broad objective'] }, checkpoint: { id: 'board', title: 'Board', objective: 'Build it', requirements: ['Use a grid'] }, languageId: 'python', selectionType: 'guide_text', selectedContent: 'Create the board.' },
      question: { id: 'q', label: 'Hi', intent: 'learner-question' }, conversation: [],
    });
    const request = createProjectMentorProviderRequest(normalized);
    expect(request.targetResponseTokens).toBe(400);
    expect(request.userContent).not.toContain('decorative description');
    expect(request.userContent).not.toContain('broad objective');
    expect(request.userContent).not.toContain('"id":"bingo"');
    expect(request.userContent).toContain('"title":"Bingo"');
  });

  it('records allowlisted cached-token usage without prompt or learner metadata', () => {
    const usage = normalizeProviderUsage({ inputTokens: 100, outputTokens: 20, cachedInputTokens: 80 }, { inputTokens: 1, outputTokens: 1 }, { known: false });
    const event = createTutorTelemetryEvent({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: 120, cachedInputTokens: usage.cachedInputTokens, prompt: 'secret', code: 'print(1)', uid: 'learner' });
    expect(event).toMatchObject({ inputTokens: 100, outputTokens: 20, totalTokens: 120, cachedInputTokens: 80 });
    expect(event).not.toHaveProperty('prompt');
    expect(event).not.toHaveProperty('code');
    expect(event).not.toHaveProperty('uid');
  });
});
