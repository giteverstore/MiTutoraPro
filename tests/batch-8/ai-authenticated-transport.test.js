import { describe, expect, it, vi } from 'vitest';

import { AITutorClient, AITutorClientError } from '../../src/ai/AITutorClient.js';
import { aiAuthenticatedRequest } from '../../src/ai/aiAuthenticatedRequest.js';
import { ProjectAIClient } from '../../src/projects/ai/ProjectAIClient.js';

function jsonResponse(payload, { ok = true, status = 200, headers = {} } = {}) {
  return {
    ok,
    status,
    headers: new Headers(headers),
    json: vi.fn().mockResolvedValue(payload),
  };
}

function validTutorResponse() {
  return {
    schemaVersion: '1',
    policyVersion: 'ai-tutor-v1',
    operation: 'explain-full-code',
    evidence: { basis: 'runtime', note: 'ok' },
    summary: 'Summary',
    sections: [],
    codeReferences: [],
    concepts: [],
    issues: [],
    nextStep: { kind: 'none', text: '' },
  };
}

function validProjectQuestions() {
  return {
    operation: 'project-questions',
    questions: ['1', '2', '3'].map((id) => ({
      id,
      label: `Question ${id}`,
      intent: 'learn',
    })),
  };
}

describe('aiAuthenticatedRequest', () => {
  it('preserves the global fetch receiver and JSON POST contract', async () => {
    const signal = new AbortController().signal;
    const fetchImpl = vi.fn(function fetchWithReceiver() {
      expect(this).toBe(globalThis);
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    await aiAuthenticatedRequest({
      fetchImpl,
      url: '/api/ai/explain',
      token: 'fresh-token',
      body: { prompt: 'Explain' },
      signal,
    });

    expect(fetchImpl).toHaveBeenCalledWith('/api/ai/explain', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer fresh-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'Explain' }),
      signal,
    });
  });

  it('keeps bodyless history requests bodyless and preserves a null token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ messages: [] }));

    await aiAuthenticatedRequest({
      fetchImpl,
      url: '/api/ai/history?contentId=project-1',
      token: null,
    });

    expect(fetchImpl).toHaveBeenCalledWith('/api/ai/history?contentId=project-1', {
      headers: { Authorization: 'Bearer null' },
      signal: undefined,
    });
  });
});

describe('AI Tutor authenticated transport integration', () => {
  it('gets a fresh token for every explain request and preserves quota metadata', async () => {
    const tokenProvider = vi.fn()
      .mockResolvedValueOnce('token-1')
      .mockResolvedValueOnce('token-2');
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(validTutorResponse(), {
      headers: {
        'X-AI-Messages-Limit': '100',
        'X-AI-Messages-Used': '27',
      },
    }));
    const client = new AITutorClient({ tokenProvider, fetchImpl });

    const first = await client.explain({ operation: 'explain-full-code' });
    await client.explain({ operation: 'explain-full-code' });

    expect(tokenProvider).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer token-1');
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer token-2');
    expect(first._tutorUsage).toEqual({
      usedMessages: 27,
      includedLimit: 100,
      unlimited: false,
    });
  });

  it('keeps missing and rejected explain authentication ahead of fetch', async () => {
    const fetchImpl = vi.fn();
    const missingClient = new AITutorClient({
      tokenProvider: vi.fn().mockResolvedValue(null),
      fetchImpl,
    });
    await expect(missingClient.explain({ operation: 'explain-full-code' }))
      .rejects.toMatchObject({
        name: 'AITutorClientError',
        code: 'ai/auth-required',
        status: 0,
      });

    const rejectedClient = new AITutorClient({
      tokenProvider: vi.fn().mockRejectedValue(new Error('token refresh failed')),
      fetchImpl,
    });
    await expect(rejectedClient.explain({ operation: 'explain-full-code' }))
      .rejects.toMatchObject({
        name: 'AITutorClientError',
        code: 'ai/auth-invalid',
      });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('preserves aborts, typed malformed-success errors, and HTTP error fields', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn();
    const abortedClient = new AITutorClient({
      tokenProvider: vi.fn().mockResolvedValue('token'),
      fetchImpl,
    });
    await expect(abortedClient.explain(
      { operation: 'explain-full-code' },
      { signal: controller.signal },
    )).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchImpl).not.toHaveBeenCalled();

    const malformedClient = new AITutorClient({
      tokenProvider: vi.fn().mockResolvedValue('token'),
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockRejectedValue(new SyntaxError('bad json')),
      }),
    });
    await expect(malformedClient.explain({ operation: 'explain-full-code' }))
      .rejects.toMatchObject({
        name: 'AITutorClientError',
        code: 'ai/provider-response-invalid',
        retryable: true,
      });

    const errorClient = new AITutorClient({
      tokenProvider: vi.fn().mockResolvedValue('token'),
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({
        error: {
          message: 'Slow down',
          code: 'ai/rate-limited',
          retryable: true,
        },
      }, { ok: false, status: 429 })),
    });
    await expect(errorClient.explain({ operation: 'explain-full-code' }))
      .rejects.toEqual(expect.objectContaining({
        name: 'AITutorClientError',
        message: 'Slow down',
        code: 'ai/rate-limited',
        status: 429,
        retryable: true,
      }));
  });

  it('preserves history cursor construction, strict parsing, and auth gating', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ messages: [], nextCursor: null }));
    const client = new AITutorClient({
      tokenProvider: vi.fn().mockResolvedValue('history-token'),
      fetchImpl,
    });

    await client.history({
      contentId: 'course-1',
      contextType: 'course',
      contextId: 'lesson-2',
      cursor: 'cursor-3',
    });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain('contentId=course-1');
    expect(url).toContain('contextType=course');
    expect(url).toContain('contextId=lesson-2');
    expect(url).toContain('cursor=cursor-3');
    expect(options.headers.Authorization).toBe('Bearer history-token');

    const missingFetch = vi.fn();
    const missingClient = new AITutorClient({
      tokenProvider: vi.fn().mockResolvedValue(null),
      fetchImpl: missingFetch,
    });
    await expect(missingClient.history({ contentId: 'course-1' }))
      .rejects.toBeInstanceOf(AITutorClientError);
    expect(missingFetch).not.toHaveBeenCalled();

    const parseError = new SyntaxError('invalid history JSON');
    const malformedClient = new AITutorClient({
      tokenProvider: vi.fn().mockResolvedValue('token'),
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(parseError),
      }),
    });
    await expect(malformedClient.history({ contentId: 'course-1' }))
      .rejects.toBe(parseError);
  });
});

describe('Project AI authenticated transport integration', () => {
  it('keeps request identifiers, payload validation, and quota metadata in the domain client', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(validProjectQuestions(), {
      headers: {
        'X-AI-Messages-Limit': '40',
        'X-AI-Messages-Used': '1',
      },
    }));
    const client = new ProjectAIClient({
      tokenProvider: vi.fn().mockResolvedValue('project-token'),
      fetchImpl,
    });

    const result = await client.request('project-questions', {
      contentId: 'project-1',
      projectVersion: 'v2',
      checkpointId: 'checkpoint-3',
    });

    const [, options] = fetchImpl.mock.calls[0];
    const requestBody = JSON.parse(options.body);
    expect(requestBody.requestId).toEqual(expect.any(String));
    expect(requestBody).toMatchObject({
      requestType: 'project-questions',
      activityType: 'project',
      contentId: 'project-1',
      projectVersion: 'v2',
      checkpointId: 'checkpoint-3',
    });
    expect(options.headers.Authorization).toBe('Bearer project-token');
    expect(result._tutorUsage).toEqual({
      usedMessages: 1,
      includedLimit: 40,
      unlimited: false,
    });
  });

  it('preserves Project request auth, token rejection, and malformed-success contracts', async () => {
    const fetchImpl = vi.fn();
    const missingClient = new ProjectAIClient({
      tokenProvider: vi.fn().mockResolvedValue(null),
      fetchImpl,
    });
    await expect(missingClient.request('project-questions', {}))
      .rejects.toMatchObject({
        name: 'AITutorClientError',
        code: 'ai/auth-required',
        status: 0,
      });
    expect(fetchImpl).not.toHaveBeenCalled();

    const tokenError = new Error('token failed');
    const rejectedClient = new ProjectAIClient({
      tokenProvider: vi.fn().mockRejectedValue(tokenError),
      fetchImpl,
    });
    await expect(rejectedClient.request('project-questions', {}))
      .rejects.toBe(tokenError);

    const malformedClient = new ProjectAIClient({
      tokenProvider: vi.fn().mockResolvedValue('token'),
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockRejectedValue(new SyntaxError('bad json')),
      }),
    });
    await expect(malformedClient.request('project-questions', {}))
      .rejects.toMatchObject({
        name: 'AITutorClientError',
        code: 'ai/provider-response-invalid',
        retryable: true,
      });
  });

  it('documents the existing Project history Bearer null behavior and cursor contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ messages: [] }));
    const client = new ProjectAIClient({
      tokenProvider: vi.fn().mockResolvedValue(null),
      fetchImpl,
    });

    await client.history({
      contentId: 'project-1',
      projectVersion: 'v5',
      checkpointId: 'checkpoint-2',
      cursor: 'cursor-4',
    });

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain('contentId=project-1');
    expect(url).toContain('projectVersion=v5');
    expect(url).toContain('checkpointId=checkpoint-2');
    expect(url).toContain('cursor=cursor-4');
    expect(options.headers.Authorization).toBe('Bearer null');
  });
});
