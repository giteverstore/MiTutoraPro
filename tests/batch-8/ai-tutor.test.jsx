import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AITutorClient } from '../../src/ai/AITutorClient.js';
import { AITutorPanel } from '../../src/ai/AITutorPanel.jsx';
import { CompilerWorkspace } from '../../src/components/CompilerWorkspace.jsx';
import { OpenAIProvider } from '../../server/ai/OpenAIProvider.js';
import { HuggingFaceProvider } from '../../server/ai/HuggingFaceProvider.js';
import { createAIProvider } from '../../server/ai/createAIProvider.js';
import { explainCode, normalizeExplainRequest, publicAIError } from '../../server/ai/explainHandler.js';

let notifyResize;

beforeEach(() => {
  notifyResize = null;
  vi.stubGlobal('ResizeObserver', class ResizeObserver {
    constructor(callback) { notifyResize = callback; }
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function resizeWorkspace(width) {
  act(() => notifyResize([{ contentRect: { width } }]));
}

const context = {
  accessTier: 'PREMIUM',
  language: 'python',
  code: 'print("Hello")',
  selectedCode: '',
  compilerEvidence: {
    source: 'print("Hello")',
    sourceHash: 'client-test-hash',
    language: 'python',
    status: 'success',
    output: 'Hello',
  },
  compilerStatus: 'success',
  lessonContext: 'Printing values',
};
const enabledFeatureGate = { assertEnabled: () => ({ enabled: true, state: 'enabled', bucket: 1, version: 'test' }) };

function structuredResponse(overrides = {}) {
  return {
    schemaVersion: '1',
    policyVersion: 'ai-tutor-v1',
    operation: 'explain-full-code',
    evidence: { basis: 'runtime', note: 'The program completed successfully.' },
    summary: 'The current code prints Hello.',
    sections: [{ title: 'How it works', body: 'The print call writes the string to standard output.' }],
    codeReferences: [{ startLine: 1, endLine: 1, explanation: 'This line produces the output.' }],
    concepts: [{ name: 'Function call', explanation: 'A function performs an operation.' }],
    issues: [],
    nextStep: { kind: 'experiment', text: 'Change the string and run the code again.' },
    ...overrides,
  };
}

const providerRequest = {
  systemInstruction: 'Tutor policy',
  userContent: 'Learner data',
  targetResponseTokens: 350,
  maxProviderTokens: 1_200,
};

describe('AI Tutor panel', () => {
  it('shows a fail-closed Premium gate without invoking the client for FREE access', () => {
    const explain = vi.fn();
    render(<AITutorPanel {...context} accessTier="FREE" client={{ explain }} />);
    expect(screen.getByRole('heading', { name: 'Premium required' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Explain full code' })).not.toBeInTheDocument();
    expect(explain).not.toHaveBeenCalled();
  });
  it('renders its initial state and disables selection explanation without a selection', () => {
    render(<AITutorPanel {...context} client={{ explain: vi.fn() }} />);
    expect(screen.getByText('AI Tutor', { selector: '.ai-tutor-header strong' })).toBeVisible();
    expect(screen.getByText('Select code or ask AI to explain your program.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Explain selection' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Explain full code' })).toBeEnabled();
    expect(screen.getByText('External AI receives relevant code and may be incorrect')).toBeVisible();
  });

  it('provides an accessible, non-blocking disclosure before the first request', () => {
    const { container } = render(<AITutorPanel {...context} client={{ explain: vi.fn() }} />);
    const disclosure = container.querySelector('.ai-tutor-disclosure');
    const summary = disclosure.querySelector('summary');
    expect(summary).toHaveTextContent('External AI');
    expect(summary).toHaveTextContent('may be incorrect');
    summary.focus();
    expect(summary).toHaveFocus();
    fireEvent.click(summary);
    expect(disclosure).toHaveAttribute('open');
    expect(disclosure).toHaveTextContent('Remove secrets or personal information');
    expect(disclosure).toHaveTextContent('verify important guidance');
    expect(disclosure.textContent).not.toMatch(/hf_|sk-|api key|token/i);
    expect(screen.getByRole('button', { name: 'Explain full code' })).toBeEnabled();
  });

  it('sends current compiler and lesson context for full-code explanations', async () => {
    const explain = vi.fn().mockResolvedValue(structuredResponse());
    render(<AITutorPanel {...context} client={{ explain }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain full code' }));
    await screen.findByText('The current code prints Hello.');
    expect(explain).toHaveBeenCalledWith(expect.objectContaining({
      requestType: 'explain-full-code', code: context.code, selectedCode: '',
      compilerEvidence: context.compilerEvidence, compilerStatus: 'success', lessonContext: 'Printing values',
    }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('sends the exact selected code for selection explanations', async () => {
    const explain = vi.fn().mockResolvedValue(structuredResponse({ operation: 'explain-selection', summary: 'Selected expression explained.' }));
    const selectionSnapshot = { text: 'print("Hello")', startOffset: 0, endOffset: 14, sourceHash: 'source', selectionHash: 'selection', language: 'python' };
    render(<AITutorPanel {...context} selectionSnapshot={selectionSnapshot} client={{ explain }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain selection' }));
    await screen.findByText('Selected expression explained.');
    expect(explain).toHaveBeenCalledWith(expect.objectContaining({ requestType: 'explain-selection', selectedCode: 'print("Hello")', selectionSnapshot }), expect.anything());
  });

  it('shows loading and sanitized failure states while preventing duplicate actions', async () => {
    let rejectRequest;
    const explain = vi.fn(() => new Promise((resolve, reject) => { rejectRequest = reject; }));
    render(<AITutorPanel {...context} client={{ explain }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain full code' }));
    expect(screen.getByText('Explaining your code…')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Explain full code' })).toBeDisabled();
    rejectRequest(new Error('The AI Tutor could not complete this explanation.'));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('The AI Tutor could not complete this explanation.');
  });

  it('renders the validated response structure with accessible code references and next step', async () => {
    const response = structuredResponse({
      issues: [{ title: 'Check the value', explanation: 'Inspect the value before printing it.', hintLevel: 1, codeReference: { startLine: 1, endLine: 1 } }],
    });
    render(<AITutorPanel {...context} client={{ explain: vi.fn().mockResolvedValue(response) }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain full code' }));
    expect(await screen.findByRole('article', { name: 'AI Tutor explanation' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'How it works' })).toBeVisible();
    expect(screen.getAllByText('Line 1')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Key concepts' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Issues to investigate' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Next step' })).toBeVisible();
  });

  it('marks an explanation stale after code changes and regenerates from current context', async () => {
    const explain = vi.fn().mockResolvedValue(structuredResponse());
    const { rerender } = render(<AITutorPanel {...context} client={{ explain }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain full code' }));
    await screen.findByText('The current code prints Hello.');
    rerender(<AITutorPanel {...context} code={'print("Updated")'} client={{ explain }} />);
    expect(await screen.findByText('This explanation is based on an earlier code or compiler snapshot.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    expect(explain).toHaveBeenLastCalledWith(expect.objectContaining({ code: 'print("Updated")' }), expect.anything());
  });

  it('does not attach a superseded response to changed code', async () => {
    let resolveRequest;
    const explain = vi.fn(() => new Promise((resolve) => { resolveRequest = resolve; }));
    const { rerender } = render(<AITutorPanel {...context} client={{ explain }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain full code' }));
    rerender(<AITutorPanel {...context} code={'print("Changed")'} client={{ explain }} />);
    resolveRequest(structuredResponse({ summary: 'Old response' }));
    await act(async () => Promise.resolve());
    expect(screen.queryByText('Old response')).not.toBeInTheDocument();
    expect(screen.getByText('Select code or ask AI to explain your program.')).toBeVisible();
  });

  it('allows cancellation and returns to the initial state without announcing an error', async () => {
    const explain = vi.fn((_, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
    }));
    render(<AITutorPanel {...context} client={{ explain }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain full code' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel explanation' }));
    expect(await screen.findByText('Select code or ask AI to explain your program.')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders model strings as text rather than executable HTML', async () => {
    const response = structuredResponse({ summary: '<img src=x onerror=alert(1)> learner text' });
    const { container } = render(<AITutorPanel {...context} client={{ explain: vi.fn().mockResolvedValue(response) }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain full code' }));
    expect(await screen.findByText('<img src=x onerror=alert(1)> learner text')).toBeVisible();
    expect(container.querySelector('.ai-tutor-structured-response img')).toBeNull();
  });
});

describe('responsive compiler workspace', () => {
  const renderWorkspace = (client = { explain: vi.fn() }) => render(
    <div>
      <CompilerWorkspace
        instanceId="test-compiler"
        editor={<label>Code<textarea aria-label="Code editor" defaultValue={'print("Hello")'} /></label>}
        tutor={<AITutorPanel {...context} client={client} />}
      />
      <section aria-label="Compiler results">Output Expected Errors</section>
    </div>,
  );

  it('keeps Monaco and the complete tutor body visible side-by-side in wide mode', () => {
    const { container } = renderWorkspace();
    resizeWorkspace(900);
    expect(container.querySelector('.compiler-workspace')).toHaveAttribute('data-workspace-mode', 'wide');
    expect(screen.getByLabelText('Code editor')).toBeVisible();
    expect(screen.getByText('AI Tutor', { selector: '.ai-tutor-header strong' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Explain selection' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Explain full code' })).toBeVisible();
  });

  it('exposes an accessible narrow switcher and preserves editor state between views', () => {
    renderWorkspace();
    resizeWorkspace(520);
    const editorTab = screen.getByRole('tab', { name: 'Editor' });
    const tutorTab = screen.getByRole('tab', { name: 'AI Tutor' });
    const editor = screen.getByLabelText('Code editor');
    fireEvent.change(editor, { target: { value: 'print("Updated")' } });

    expect(editorTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(tutorTab);
    expect(tutorTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Explain full code' })).toBeVisible();
    expect(screen.getByText('External AI receives relevant code and may be incorrect')).toBeVisible();
    expect(screen.getByLabelText('Compiler results')).toBeVisible();

    fireEvent.click(editorTab);
    expect(screen.getByLabelText('Code editor')).toHaveValue('print("Updated")');
  });

  it('supports keyboard tab navigation and preserves an AI response while switching', async () => {
    const explain = vi.fn().mockResolvedValue(structuredResponse());
    renderWorkspace({ explain });
    resizeWorkspace(420);
    const editorTab = screen.getByRole('tab', { name: 'Editor' });
    fireEvent.keyDown(editorTab, { key: 'ArrowRight' });
    const tutorTab = screen.getByRole('tab', { name: 'AI Tutor' });
    expect(tutorTab).toHaveFocus();
    expect(tutorTab).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Explain full code' }));
    await screen.findByText('The current code prints Hello.');
    fireEvent.click(editorTab);
    fireEvent.click(tutorTab);
    expect(screen.getByText('The current code prints Hello.')).toBeVisible();
  });

  it('keeps selection explanation disabled until selected code exists', () => {
    const { rerender } = render(<AITutorPanel {...context} client={{ explain: vi.fn() }} />);
    expect(screen.getByRole('button', { name: 'Explain selection' })).toBeDisabled();
    rerender(<AITutorPanel {...context} selectionSnapshot={{ text: 'print', startOffset: 0, endOffset: 5, sourceHash: 'source', selectionHash: 'selection', language: 'python' }} client={{ explain: vi.fn() }} />);
    expect(screen.getByRole('button', { name: 'Explain selection' })).toBeEnabled();
  });
});

describe('AI Tutor client and server boundary', () => {
  it('invokes browser fetch with the global receiver', async () => {
    const fetchImpl = vi.fn(function fetchWithReceiver() {
      expect(this).toBe(globalThis);
      return Promise.resolve({ ok: true, json: async () => structuredResponse({ summary: 'Bound response' }) });
    });
    const client = new AITutorClient({ fetchImpl, tokenProvider: async () => 'test-id-token' });
    await expect(client.explain(context)).resolves.toMatchObject({ summary: 'Bound response' });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer test-id-token');
  });

  it('rejects malformed normalized API responses', async () => {
    const client = new AITutorClient({ fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ wrong: true }) }), tokenProvider: async () => 'test-id-token' });
    await expect(client.explain(context)).rejects.toThrow('invalid response');
  });

  it('validates selection requests and bounds context without accepting private identity data', () => {
    expect(() => normalizeExplainRequest({ ...context, requestType: 'explain-selection' })).toThrow('Select code');
    const normalized = normalizeExplainRequest({ ...context, requestType: 'explain-full-code', uid: 'private', cookie: 'private' });
    expect(normalized).not.toHaveProperty('uid');
    expect(normalized).not.toHaveProperty('cookie');
  });

  it('uses the Responses API and returns normalized text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: 'Clear explanation' }) });
    const provider = new OpenAIProvider({ apiKey: 'server-only-test-key', model: 'gpt-5.4-mini', fetchImpl });
    await expect(provider.explain(providerRequest)).resolves.toEqual({ text: 'Clear explanation', usage: undefined });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.openai.com/v1/responses', expect.objectContaining({ method: 'POST' }));
    const request = fetchImpl.mock.calls[0][1];
    expect(JSON.parse(request.body)).toMatchObject({
      model: 'gpt-5.4-mini',
      max_output_tokens: 1_200,
      instructions: 'Tutor policy',
      input: 'Learner data',
      store: false,
      text: { format: { type: 'json_schema', name: 'mi_tutora_ai_tutor_response', strict: true } },
    });
  });

  it('sanitizes provider errors and never returns the API key', async () => {
    const provider = new OpenAIProvider({ apiKey: 'server-only-test-key', model: 'gpt-5.4-mini', fetchImpl: vi.fn().mockResolvedValue({ ok: false }) });
    let error;
    try { await explainCode({ ...context, requestType: 'explain-full-code' }, { principal: { uid: 'test-user' }, featureGate: enabledFeatureGate, rateLimiter: { assertAllowed: vi.fn() }, providerFactory: () => provider }); }
    catch (caught) { error = caught; }
    const publicError = publicAIError(error);
    expect(publicError.status).toBe(502);
    expect(JSON.stringify(publicError)).not.toContain('server-only-test-key');
    expect(publicError.body.error.code).toBe('ai/provider-failed');
  });

  it('selects Hugging Face and takes its model from AI_MODEL', () => {
    const provider = createAIProvider({
      AI_PROVIDER: 'huggingface',
      AI_MODEL: 'openai/gpt-oss-120b:fastest',
      HF_TOKEN: 'server-only-hf-test-token',
    });
    expect(provider).toBeInstanceOf(HuggingFaceProvider);
    expect(provider.model).toBe('openai/gpt-oss-120b:fastest');
  });

  it('rejects a missing Hugging Face token without exposing configuration details', () => {
    let error;
    try {
      createAIProvider({ AI_PROVIDER: 'huggingface', AI_MODEL: 'openai/gpt-oss-120b:fastest' });
    } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: 'ai/not-configured', status: 503 });
    expect(JSON.stringify(publicAIError(error))).not.toContain('HF_TOKEN');
  });

  it('normalizes a successful Hugging Face chat completion', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'The program prints **Hello**.' } }] }),
    });
    const provider = new HuggingFaceProvider({
      token: 'server-only-hf-test-token',
      model: 'openai/gpt-oss-120b:fastest',
      fetchImpl,
    });
    await expect(provider.explain(providerRequest)).resolves.toEqual({ text: 'The program prints **Hello**.', usage: undefined });
    expect(fetchImpl).toHaveBeenCalledWith('https://router.huggingface.co/v1/chat/completions', expect.objectContaining({ method: 'POST' }));
    const request = fetchImpl.mock.calls[0][1];
    expect(JSON.parse(request.body)).toMatchObject({
      model: 'openai/gpt-oss-120b:fastest',
      messages: [
        { role: 'system', content: expect.any(String) },
        { role: 'user', content: expect.any(String) },
      ],
      max_tokens: 1_200,
      reasoning_effort: 'low',
      response_format: { type: 'json_schema', json_schema: expect.objectContaining({ name: 'mi_tutora_ai_tutor_response', strict: true }) },
    });
    expect(request.headers.Authorization).toBe('Bearer server-only-hf-test-token');
  });

  it('normalizes Hugging Face provider failures without returning the token', async () => {
    const token = 'server-only-sensitive-hf-token';
    const provider = new HuggingFaceProvider({
      token,
      model: 'openai/gpt-oss-120b:fastest',
      fetchImpl: vi.fn().mockResolvedValue({ ok: false }),
    });
    let error;
    try { await explainCode({ ...context, requestType: 'explain-full-code' }, { principal: { uid: 'test-user' }, featureGate: enabledFeatureGate, rateLimiter: { assertAllowed: vi.fn() }, providerFactory: () => provider }); }
    catch (caught) { error = caught; }
    const publicError = publicAIError(error);
    expect(publicError).toMatchObject({ status: 502, body: { error: { code: 'ai/provider-failed' } } });
    expect(JSON.stringify(publicError)).not.toContain(token);
  });

  it.each([
    [401, 'ai/provider-auth', 503],
    [404, 'ai/model-unavailable', 503],
    [429, 'ai/provider-rate-limited', 429],
    [400, 'ai/provider-rejected', 502],
  ])('normalizes Hugging Face HTTP %s without returning provider details', async (status, code, publicStatus) => {
    const provider = new HuggingFaceProvider({
      token: 'server-only-token',
      model: 'test-model',
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status }),
    });
    let error;
    try { await provider.explain(providerRequest); } catch (caught) { error = caught; }
    expect(publicAIError(error)).toMatchObject({ status: publicStatus, body: { error: { code } } });
  });

  it('retains only allowlisted diagnostics from a Hugging Face rejection body', async () => {
    const privateDetail = 'private provider explanation that must not escape';
    const bytes = new TextEncoder().encode(JSON.stringify({
      error: { code: 'content_filter', message: privateDetail },
    }));
    let consumed = false;
    const provider = new HuggingFaceProvider({
      token: 'server-only-token',
      model: 'test-model',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        body: {
          getReader: () => ({
            read: async () => consumed ? { done: true } : (consumed = true, { done: false, value: bytes }),
            cancel: async () => {},
            releaseLock: () => {},
          }),
        },
      }),
    });
    let error;
    try { await provider.explain(providerRequest); } catch (caught) { error = caught; }
    expect(error.providerDiagnostic).toEqual({
      providerStatus: 400,
      providerCode: 'provider-content-policy',
      providerClassification: 'safety-rejected',
    });
    expect(publicAIError(error)).toMatchObject({ status: 502, body: { error: { code: 'ai/provider-rejected' } } });
    expect(JSON.stringify(error)).not.toContain(privateDetail);
    expect(JSON.stringify(publicAIError(error))).not.toContain('provider-content-policy');
  });

  it('normalizes a provider content-policy refusal', async () => {
    const provider = new HuggingFaceProvider({
      token: 'server-only-token',
      model: 'test-model',
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ finish_reason: 'content_filter', message: { content: '' } }] }),
      }),
    });
    let error;
    try { await provider.explain(providerRequest); } catch (caught) { error = caught; }
    expect(publicAIError(error)).toMatchObject({ status: 422, body: { error: { code: 'ai/provider-refusal' } } });
  });

  it('preserves caller aborts for Hugging Face requests', async () => {
    const fetchImpl = vi.fn((_, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
    }));
    const provider = new HuggingFaceProvider({ token: 'test-token', model: 'test-model', fetchImpl });
    const controller = new AbortController();
    const pending = provider.explain(providerRequest, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('returns a sanitized timeout when Hugging Face exceeds its provider deadline', async () => {
    const token = 'server-only-timeout-token';
    const fetchImpl = vi.fn((_, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const provider = new HuggingFaceProvider({ token, model: 'test-model', fetchImpl, timeoutMs: 5 });
    let error;
    try { await provider.explain(providerRequest); } catch (caught) { error = caught; }
    const publicError = publicAIError(error);
    expect(publicError).toMatchObject({ status: 504, body: { error: { code: 'ai/provider-timeout' } } });
    expect(JSON.stringify(publicError)).not.toContain(token);
  });

  it('keeps OpenAI selectable after adding Hugging Face', () => {
    const provider = createAIProvider({ AI_PROVIDER: 'openai', AI_MODEL: 'gpt-5.4-mini', OPENAI_API_KEY: 'server-only-openai-test-token' });
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.model).toBe('gpt-5.4-mini');
  });
});
