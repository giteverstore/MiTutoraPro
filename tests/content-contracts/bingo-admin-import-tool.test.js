import { describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import {
  ADMIN_PRODUCTION_ORIGIN,
  BingoImportError,
  parseOptions,
  prepareBingoDocument,
  runBingoImport,
} from '../../scripts/content/import-bingo-admin.mjs';

const source = 'C:/Work/MiTutoraPro/content/projects/bingo/bingoProjectDraft.mjs';
const options = { baseUrl: ADMIN_PRODUCTION_ORIGIN, source, execute: true, confirmed: true };
const token = 'private-token-'.repeat(12);
const document = { contentId: 'bingo', contentType: 'PROJECT', status: 'draft' };
const requestBody = JSON.stringify({ contentType: 'PROJECT', document, expectedRevision: 0 });
const prepared = { document, requestBody, report: { contentId: 'bingo', contentType: 'PROJECT', requestBytes: Buffer.byteLength(requestBody) } };
const created = { draft: { contentId: 'bingo', contentType: 'PROJECT', draftRevision: 1, lifecycleState: 'DRAFT', validationSummary: null, document } };

function server({ exact = { draft: null }, history = { versions: [], active: null }, summaries = { items: [], nextCursor: null }, detail = null, create = created } = {}) {
  const calls = [];
  const fetcher = vi.fn(async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/drafts/bingo') && init.method === 'GET') return Response.json(exact);
    if (url.endsWith('/history/bingo')) return Response.json(history);
    if (url.includes('/draft-summaries?')) return Response.json(summaries);
    if (url.endsWith('/drafts/other')) return Response.json(detail);
    if (url.endsWith('/drafts') && init.method === 'POST') return Response.json(create);
    return Response.json({ error: { code: 'unexpected' } }, { status: 500 });
  });
  return { calls, fetcher };
}

const invoke = (fetcher, overrides = {}) => runBingoImport(options, {
  token, loadSource: async () => prepared, fetcher, output: vi.fn(), ...overrides,
});

describe('one-shot authenticated Bingo Admin import tool', () => {
  it('accepts only pinned Production, PROJECT, source, and explicit execution confirmation', () => {
    const common = ['--base-url', ADMIN_PRODUCTION_ORIGIN, '--content-type', 'PROJECT', '--source', source];
    expect(parseOptions(common)).toMatchObject({ execute: false, source: resolve(source) });
    expect(parseOptions([...common, '--execute', 'yes', '--confirm', 'bingo:PROJECT'])).toMatchObject({ execute: true, confirmed: true });
    expect(() => parseOptions([...common, '--execute', 'yes'])).toThrow(/--confirm/);
    expect(() => parseOptions([...common, '--execute', 'yes', '--confirm', 'other'])).toThrow();
    expect(() => parseOptions([...common, '--base-url', 'https://preview.example'])).toThrow();
    expect(() => parseOptions(['--base-url', ADMIN_PRODUCTION_ORIGIN, '--content-type', 'COURSE', '--source', source])).toThrow();
    expect(() => parseOptions(['--base-url', ADMIN_PRODUCTION_ORIGIN, '--content-type', 'PROJECT', '--source', 'other.mjs'])).toThrow();
  });

  it('makes no network request and no mutation in dry-run mode', async () => {
    const fetcher = vi.fn();
    const output = vi.fn();
    await runBingoImport({ ...options, execute: false, confirmed: false }, { fetcher, token: '', loadSource: async () => prepared, output });
    expect(fetcher).not.toHaveBeenCalled();
    expect(output.mock.calls[0][0]).toContain('"productionMutation":false');
  });

  it('refuses missing authentication or direct execution without confirmation before any request', async () => {
    const fetcher = vi.fn();
    await expect(invoke(fetcher, { token: '' })).rejects.toThrow(/ADMIN_FIREBASE_ID_TOKEN/);
    await expect(runBingoImport({ ...options, confirmed: false }, { token, fetcher, loadSource: async () => prepared })).rejects.toThrow(/confirmation/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refuses invalid canonical content before any network mutation', async () => {
    const fetcher = vi.fn();
    await expect(invoke(fetcher, { loadSource: async () => prepareBingoDocument({ contentId: 'bingo', contentType: 'PROJECT', content: {} }) })).rejects.toBeInstanceOf(BingoImportError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends one authenticated PROJECT create request after clean read-only preflight', async () => {
    const { calls, fetcher } = server();
    const output = vi.fn();
    expect(await invoke(fetcher, { output })).toMatchObject({ mode: 'created', contentId: 'bingo', revision: 1, lifecycle: 'DRAFT' });
    expect(calls.map((call) => [new URL(call.url).pathname, call.init.method])).toEqual([
      ['/api/admin-content/drafts/bingo', 'GET'],
      ['/api/admin-content/history/bingo', 'GET'],
      ['/api/admin-content/draft-summaries', 'GET'],
      ['/api/admin-content/drafts', 'POST'],
    ]);
    const post = calls.at(-1);
    expect(JSON.parse(post.init.body)).toMatchObject({ contentType: 'PROJECT', expectedRevision: 0 });
    expect(post.init.headers.Authorization).toBe(`Bearer ${token}`);
    expect(post.init.redirect).toBe('error');
    expect(JSON.stringify(output.mock.calls)).not.toContain(token);
    expect(JSON.stringify(output.mock.calls)).not.toContain('Authorization');
  });

  it('refuses an existing Bingo draft or publication before create', async () => {
    for (const fixture of [{ exact: { draft: { contentId: 'bingo' } } }, { history: { versions: [{ version: 1 }], active: null } }, { history: { versions: [], active: { activeVersion: 1 } } }]) {
      const { calls, fetcher } = server(fixture);
      await expect(invoke(fetcher)).rejects.toThrow(/already exists/);
      expect(calls.some((call) => call.init.method === 'POST')).toBe(false);
    }
  });

  it('refuses a PROJECT slug or title collision after inspecting its draft detail', async () => {
    for (const project of [{ projectId: 'bingo', title: 'Other' }, { projectId: 'other', title: 'Bingo' }, { projectId: 'other', slug: 'bingo', title: 'Other' }]) {
      const { calls, fetcher } = server({ summaries: { items: [{ contentId: 'other', contentType: 'PROJECT', title: 'Other' }], nextCursor: null }, detail: { draft: { document: { content: project } } } });
      await expect(invoke(fetcher)).rejects.toThrow(/collision/);
      expect(calls.some((call) => call.init.method === 'POST')).toBe(false);
    }
  });

  it('fails closed on 401/403 without logging token or provider error details', async () => {
    for (const status of [401, 403]) {
      const fetcher = vi.fn(async () => Response.json({ error: { message: `Authorization: Bearer ${token}` } }, { status }));
      const output = vi.fn();
      let message = '';
      try { await invoke(fetcher, { output }); } catch (error) { message = error.message; }
      expect(message).toContain(String(status));
      expect(message).not.toContain(token);
      expect(JSON.stringify(output.mock.calls)).not.toContain(token);
    }
  });

  it('sends a representative 136 KB JSON payload without truncation or retry', async () => {
    const largeDocument = { ...document, text: 'x'.repeat(136_000) };
    const largeBody = JSON.stringify({ contentType: 'PROJECT', document: largeDocument, expectedRevision: 0 });
    const { calls, fetcher } = server({ create: { draft: { ...created.draft, document: largeDocument } } });
    await invoke(fetcher, { loadSource: async () => ({ ...prepared, document: largeDocument, requestBody: largeBody }) });
    const posts = calls.filter((call) => call.init.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(Buffer.byteLength(posts[0].init.body)).toBeGreaterThan(136_000);
    expect(posts[0].init.body).toBe(largeBody);
  });

  it('never retries an uncertain create response', async () => {
    const { calls, fetcher } = server();
    const failing = vi.fn(async (url, init) => init.method === 'POST' ? Promise.reject(new Error(`Bearer ${token}`)) : fetcher(url, init));
    let message = '';
    try { await invoke(failing); } catch (error) { message = error.message; }
    expect(message).toContain('do not retry');
    expect(message).not.toContain(token);
    expect(failing.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
    expect(calls.filter((call) => call.init.method === 'POST')).toHaveLength(0);
  });
});
