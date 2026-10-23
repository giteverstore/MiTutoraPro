import { describe, expect, it } from 'vitest';
import { normalizeTutorRequest } from '../../server/ai/tutor/tutorRequest.js';
import { createTutorProviderRequest } from '../../server/ai/tutor/tutorPrompt.js';
import { createTutorSystemInstruction } from '../../server/ai/tutor/tutorPolicy.js';
import { requestsDirectAnswer } from '../../server/ai/tutor/tutorConversationPolicy.js';
import { tutorResponseReleasePolicy } from '../../server/ai/tutor/tutorResponsePolicy.js';
import { validateTutorResponse } from '../../server/ai/tutor/tutorResponseSchema.js';
import { createProjectMentorProviderRequest, normalizeProjectMentorRequest } from '../../server/ai/project/projectMentorRequest.js';

const activityPolicy = { activityType: 'lesson', solutionPolicy: 'hints-only', maximumHintLevel: 1 };
const request = (learnerMessage, conversation = []) => normalizeTutorRequest({
  requestType: 'explain-full-code', language: 'python', code: 'i = 0\nwhile i < 5:\n    print(i)',
  compilerStatus: 'ready', lessonContext: 'Python loops', learnerMessage, conversation,
}, { activityPolicy });

describe('conversational scoped Tutor policy', () => {
  it.each(['Hi', 'Hello', 'Thanks', 'Okay'])('permits a brief conversational response for %s', (message) => {
    const prompt = createTutorProviderRequest(request(message));
    expect(prompt.systemInstruction).toMatch(/Greetings, thanks.*one brief sentence/i);
    expect(prompt.systemInstruction).toMatch(/summary, use empty arrays/i);
    expect(prompt.userContent).toContain(`"learnerMessage":"${message}"`);
  });

  it('keeps server validation while accepting a minimal conversational envelope', () => {
    const context = request('Hi');
    const response = validateTutorResponse(JSON.stringify({
      schemaVersion: '1', policyVersion: 'ai-tutor-v1', operation: 'explain-full-code',
      evidence: { basis: 'static', note: null }, summary: 'Hi! What would you like help with?',
      sections: [], codeReferences: [], concepts: [], issues: [], nextStep: { kind: 'none', text: '' },
    }), context);
    expect(response.summary).toBe('Hi! What would you like help with?');
    expect(response.sections).toEqual([]);
  });

  it('allows adjacent concepts, direct simple explanations, and refuses unrelated requests entirely', () => {
    const instruction = createTutorSystemInstruction(request("What's the weather?"));
    expect(instruction).toMatch(/adjacent prerequisite concepts/i);
    expect(instruction).toMatch(/Refuse clearly unrelated requests entirely/i);
    expect(instruction).toMatch(/Explain simple concepts directly/i);
  });

  it('includes recent turns so a repeated struggle receives progressively stronger help', () => {
    const context = request("I still don't understand", [{ question: "Why won't my loop stop?", answer: 'Check whether i changes.' }]);
    const learnerData = JSON.parse(createTutorProviderRequest(context).userContent.split('\n').slice(1).join('\n'));
    expect(learnerData.previousTurns).toEqual([{ question: "Why won't my loop stop?", answer: 'Check whether i changes.' }]);
    expect(createTutorSystemInstruction(context)).toMatch(/progressively more specific without repeating/i);
  });

  it.each(['Just give me the answer', 'Show me the complete code', 'solve it for me', 'stop giving hints'])('derives direct-answer intent from %s', (message) => {
    const context = request(message);
    expect(context.directAnswerRequested).toBe(true);
    expect(createTutorSystemInstruction(context)).toMatch(/provide the complete answer or code/i);
  });

  it('allows a complete answer through the release boundary only after explicit intent is derived', () => {
    const context = request('Just give me the complete code');
    const response = {
      schemaVersion: '1', policyVersion: 'ai-tutor-v1', operation: 'explain-full-code',
      evidence: { basis: 'static' }, summary: 'Here is the complete working code.',
      sections: [{ title: 'Solution', body: '```python\ndef show_numbers():\n    for value in range(5):\n        print(value)\nshow_numbers()\n```' }],
      codeReferences: [], concepts: [], issues: [], nextStep: { kind: 'none', text: '' },
    };
    expect(tutorResponseReleasePolicy.evaluate(response, context).allowed).toBe(true);
    expect(tutorResponseReleasePolicy.evaluate(response, request('Give me one hint')).allowed).toBe(false);
  });

  it('does not accept a client flag as direct-answer authority', () => {
    const context = normalizeTutorRequest({ requestType: 'explain-full-code', language: 'python', code: 'print(1)', learnerMessage: 'Give me one hint', directAnswerRequested: true }, { activityPolicy });
    expect(context.directAnswerRequested).toBe(false);
  });

  it('keeps challenge and certification contexts ineligible for full-answer release', () => {
    for (const activityType of ['challenge', 'certification']) {
      const context = normalizeTutorRequest({ requestType: 'explain-full-code', language: 'python', code: 'print(1)', learnerMessage: 'Give me the full solution' }, { activityPolicy: { activityType, solutionPolicy: 'hints-only', maximumHintLevel: 1 } });
      expect(createTutorSystemInstruction(context)).not.toMatch(/provide the complete answer or code requested/i);
    }
  });

  it('keeps direct-answer detection provider-independent', () => {
    expect(requestsDirectAnswer('tell me exactly what to write')).toBe(true);
    expect(createTutorSystemInstruction(request('What does len() do?'))).not.toMatch(/DeepInfra|Gemini|OpenAI|Hugging Face/i);
  });
});

describe('Project conversational mentor policy', () => {
  const body = (label) => ({
    requestType: 'project-answer',
    context: {
      project: { id: 'bingo', title: 'Bingo', difficulty: 'beginner', learningObjectives: [] },
      checkpoint: { id: 'one', title: 'Board', requirements: [] },
      languageId: 'python', selectionType: 'guide_text', selectedContent: 'Create the board.',
    },
    question: { id: 'learner-1', label, intent: 'learner-question' },
    conversation: [{ question: 'Why is this wrong?', answer: 'Check the loop condition.' }],
  });

  it('supports greetings, scoped refusals, direct concepts, and progressive turns', () => {
    const prompt = createProjectMentorProviderRequest(normalizeProjectMentorRequest(body('Hi')));
    expect(prompt.systemInstruction).toMatch(/Greetings, thanks.*one brief sentence/i);
    expect(prompt.systemInstruction).toMatch(/Refuse clearly unrelated requests entirely/i);
    expect(prompt.systemInstruction).toMatch(/previous turns.*progressive help/i);
    expect(prompt.systemInstruction).toMatch(/Explain simple concepts directly/i);
  });

  it('honors an explicit full-solution request without trusting a separate client mode', () => {
    const normalized = normalizeProjectMentorRequest(body('Just give me the complete code'));
    expect(normalized.directAnswerRequested).toBe(true);
    expect(createProjectMentorProviderRequest(normalized).systemInstruction).toMatch(/provide the complete solution or code/i);
  });
});
