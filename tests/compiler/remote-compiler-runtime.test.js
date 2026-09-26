import { describe, expect, it, vi } from 'vitest';
import { RemoteCompilerClient } from '../../src/compiler/runtimes/remote/RemoteCompilerClient.js';
import { goLanguage } from '../../src/compiler/languages/go.js';
import { rustLanguage } from '../../src/compiler/languages/rust.js';
import { getSupportedCompilerLanguage } from '../../src/compiler/languages/supportedLanguages.js';

describe('remote compiler browser runtime', () => {
  it.each([
    [goLanguage, 'go', 'Go', 'main.go', 'go'],
    [rustLanguage, 'rust', 'Rust', 'main.rs', 'rust'],
  ])('registers %s after the local runner gate', (definition, id, label, fileName, monacoLanguage) => {
    expect(definition).toEqual(expect.objectContaining({ id, label, defaultFileName: fileName, monacoLanguage, executionMode: 'terminal', executionProvider: 'remote' }));
    expect(getSupportedCompilerLanguage(id)).toBe(definition);
  });

  it('authenticates and sends only the normalized execution contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'success', output: 'ok\n', stdout: 'ok\n', stderr: '', errors: [], executionTimeMs: 3 }) });
    const client = new RemoteCompilerClient({ language: 'go', fetchImpl, tokenProvider: async () => 'test-token' });
    await expect(client.execute({ source: 'package main', stdin: 'x', execution: { contentId: 'q1', contentType: 'practice' } })).resolves.toEqual(expect.objectContaining({ status: 'success', output: 'ok\n' }));
    expect(fetchImpl).toHaveBeenCalledWith('/api/compiler/execute', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer test-token' }), body: JSON.stringify({ language: 'go', source: 'package main', stdin: 'x', contentId: 'q1', contentType: 'practice' }) }));
  });

  it('does not call the API without a signed-in user', async () => {
    const fetchImpl = vi.fn(); const client = new RemoteCompilerClient({ language: 'rust', fetchImpl, tokenProvider: async () => null });
    await expect(client.execute({ source: 'fn main() {}' })).rejects.toThrow('Sign in'); expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('routes a public standalone execution to the dedicated endpoint without requiring auth', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ language: 'rust', status: 'success', stdout: 'ok\n' }) });
    const client = new RemoteCompilerClient({ language: 'rust', fetchImpl, tokenProvider: async () => null });
    await expect(client.execute({ source: 'fn main() {}', stdin: '', execution: { publicStandalone: true } })).resolves.toMatchObject({ status: 'success' });
    expect(fetchImpl).toHaveBeenCalledWith('/api/compiler/remote/public', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ languageId: 'rust', source: 'fn main() {}', stdin: '' }),
    }));
  });

  it('forwards optional auth on public standalone execution', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'success' }) });
    const client = new RemoteCompilerClient({ language: 'go', fetchImpl, tokenProvider: async () => 'optional-token' });
    await client.execute({ source: 'package main', execution: { publicStandalone: true } });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer optional-token');
  });

  it('keeps a disabled public language page usable with a clean language-specific error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { code: 'compiler/runner-unavailable', message: 'internal' } }) });
    const client = new RemoteCompilerClient({ language: 'go', fetchImpl, tokenProvider: async () => null });
    await expect(client.execute({ source: 'package main', execution: { publicStandalone: true } })).rejects.toThrow('Go compiler is temporarily unavailable.');
  });
});
