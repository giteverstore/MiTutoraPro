import { describe, expect, it, vi } from 'vitest';
import { createPublicMySqlExecutionHandler } from '../../server/mysql/publicMySqlExecutionHandler.js';
import { MySqlExecutionError } from '../../server/mysql/MySqlExecutionError.js';

const environment = { PUBLIC_MYSQL_RUNTIME_ENABLED: 'true', MYSQL_RUNTIME_ENABLED: 'true', MYSQL_DISTRIBUTED_QUOTA_ENABLED: 'true' };
function exchange(body = { sql: 'SELECT 1;' }, headers = {}) {
  const request = { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers }, socket: { remoteAddress: '127.0.0.1' } };
  const response = { writableEnded: false, headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; this.writableEnded = true; return this; } };
  return { request, response };
}
function dependencies(overrides = {}) {
  const quota = { acquire: vi.fn().mockResolvedValue({ executionId: 'execution', identityHash: 'hash' }), release: vi.fn().mockResolvedValue() };
  const execute = vi.fn().mockResolvedValue({ status: 'success', database: { dialect: 'mysql', resultSets: [] }, output: '', errors: [] });
  return { environment, authenticator: { authenticate: vi.fn().mockResolvedValue({ uid: 'verified-user' }) }, credentialFactory: () => ({ preflight: vi.fn().mockResolvedValue() }), quotaFactory: vi.fn().mockResolvedValue({ quota, close: vi.fn().mockResolvedValue() }), serviceFactory: () => ({ execute }), logger: { info: vi.fn() }, quota, execute, ...overrides };
}

describe('public MySQL execution contract', () => {
  it('runs an anonymous request in an empty sandbox and releases its lease', async () => {
    const deps = dependencies(); const value = exchange({ sql: 'CREATE TABLE items(id INT);' }, { 'x-vercel-forwarded-for': '203.0.113.2' });
    await createPublicMySqlExecutionHandler(deps)(value.request, value.response);
    expect(value.response.statusCode).toBe(200);
    expect(deps.authenticator.authenticate).not.toHaveBeenCalled();
    expect(deps.quota.acquire).toHaveBeenCalledWith(expect.objectContaining({ authenticated: false }));
    expect(deps.execute).toHaveBeenCalledWith(expect.objectContaining({ source: 'CREATE TABLE items(id INT);', setupSql: '' }));
    expect(deps.quota.release).toHaveBeenCalled();
  });

  it('uses verified optional auth and never trusts or accepts a client UID', async () => {
    const deps = dependencies(); const accepted = exchange({ sql: 'SELECT 1;' }, { authorization: 'Bearer valid' });
    await createPublicMySqlExecutionHandler(deps)(accepted.request, accepted.response);
    expect(deps.quota.acquire).toHaveBeenCalledWith({ identity: 'verified-user', authenticated: true });
    const spoofed = exchange({ sql: 'SELECT 1;', uid: 'attacker' }, { authorization: 'Bearer valid' });
    await createPublicMySqlExecutionHandler(deps)(spoofed.request, spoofed.response);
    expect(spoofed.response).toMatchObject({ statusCode: 400, body: { error: { code: 'compiler/mysql-invalid-request' } } });
  });

  it('rejects invalid supplied auth instead of downgrading it', async () => {
    const deps = dependencies({ authenticator: { authenticate: vi.fn().mockRejectedValue(new Error('invalid')) } }); const value = exchange({ sql: 'SELECT 1;' }, { authorization: 'Bearer invalid' });
    await createPublicMySqlExecutionHandler(deps)(value.request, value.response);
    expect(value.response).toMatchObject({ statusCode: 401, body: { error: { code: 'compiler/mysql-invalid-auth' } } });
    expect(deps.quota.acquire).not.toHaveBeenCalled();
  });

  it.each([
    [{ source: 'SELECT 1;' }, 400, 'compiler/mysql-invalid-request'],
    [{ sql: 1 }, 400, 'compiler/mysql-invalid-request'],
    [{ sql: 'SELECT 1;', setupSql: 'CREATE TABLE hidden(id INT)' }, 400, 'compiler/mysql-invalid-request'],
    [{ sql: 'SELECT 1;', host: 'database.internal' }, 400, 'compiler/mysql-invalid-request'],
    [{ sql: '   ' }, 400, 'mysql/empty-query'],
    [{ sql: 'x'.repeat(65_537) }, 413, 'compiler/mysql-source-too-large'],
  ])('rejects unsafe request shape', async (body, status, code) => {
    const deps = dependencies(); const value = exchange(body); await createPublicMySqlExecutionHandler(deps)(value.request, value.response);
    expect(value.response).toMatchObject({ statusCode: status, body: { error: { code } } }); expect(deps.execute).not.toHaveBeenCalled();
  });

  it('rejects non-JSON content types', async () => {
    const deps = dependencies(); const value = exchange({ sql: 'SELECT 1;' }, { 'content-type': 'text/plain' });
    await createPublicMySqlExecutionHandler(deps)(value.request, value.response);
    expect(value.response).toMatchObject({ statusCode: 415, body: { error: { code: 'compiler/mysql-invalid-request' } } });
    expect(deps.execute).not.toHaveBeenCalled();
  });

  it('fails closed unless both public and infrastructure gates are exact true', async () => {
    for (const env of [{ ...environment, PUBLIC_MYSQL_RUNTIME_ENABLED: 'false' }, { ...environment, MYSQL_RUNTIME_ENABLED: 'false' }]) {
      const deps = dependencies({ environment: env }); const value = exchange(); await createPublicMySqlExecutionHandler(deps)(value.request, value.response); expect(value.response.statusCode).toBe(503); expect(deps.execute).not.toHaveBeenCalled();
    }
  });

  it('releases the lease and sanitizes infrastructure failures', async () => {
    const deps = dependencies({ serviceFactory: () => ({ execute: vi.fn().mockRejectedValue(new Error('mysql.internal password=secret')) }) }); const value = exchange();
    await createPublicMySqlExecutionHandler(deps)(value.request, value.response);
    expect(value.response).toEqual(expect.objectContaining({ statusCode: 503, body: { error: { code: 'compiler/mysql-server-error', message: 'The MySQL compiler is temporarily unavailable.' } } }));
    expect(deps.quota.release).toHaveBeenCalled();
  });

  it('preserves useful learner SQL errors without infrastructure details', async () => {
    const error = new MySqlExecutionError('mysql/query-error', 'MySQL error (ER_BAD_FIELD_ERROR) [42S22]: Unknown column', { status: 400 });
    const deps = dependencies({ serviceFactory: () => ({ execute: vi.fn().mockRejectedValue(error) }) }); const value = exchange(); await createPublicMySqlExecutionHandler(deps)(value.request, value.response);
    expect(value.response).toMatchObject({ statusCode: 400, body: { error: { code: 'mysql/query-error' } } });
  });
});
