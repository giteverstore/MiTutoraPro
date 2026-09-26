import { describe, expect, it, vi } from 'vitest';
import { MySqlExecutionClient } from '../../src/compiler/runtimes/mysql/MySqlExecutionClient.js';
import { MySqlRuntime } from '../../src/compiler/runtimes/mysql/MySqlRuntime.js';
import { MySqlSandboxService } from '../../server/mysql/MySqlSandboxService.js';
import { MySqlExecutionError } from '../../server/mysql/MySqlExecutionError.js';
import { normalizeMySqlStatementResult } from '../../server/mysql/mysqlResultNormalization.js';
import { splitMySqlStatements, validateMySqlScript } from '../../server/mysql/mysqlSqlPolicy.js';
import { createMySqlExecutionHandler, publicMySqlError } from '../../server/mysql/mysqlExecutionHandler.js';
import { MySqlAbuseGuard } from '../../server/mysql/mysqlAbuseGuard.js';
import { MySqlCanonicalSetupResolver } from '../../server/mysql/mysqlCanonicalSetupResolver.js';
import { cleanStaleMySqlSandboxes, parseSandboxTimestamp } from '../../server/mysql/mysqlSandboxJanitor.js';
import { mysqlInfrastructureInternals } from '../../server/mysql/mysqlInfrastructure.js';
import { MySqlDistributedQuota } from '../../server/mysql/MySqlDistributedQuota.js';
import { FirebaseMySqlContentSource } from '../../server/mysql/FirebaseMySqlContentSource.js';
import { createMySqlJanitorHandler } from '../../api/compiler/mysql/janitor.js';

describe('MySQL registry runtime client', () => {
  it('invokes the browser fetch dependency without rebinding its receiver', async () => {
    let receiver;
    const fetchImpl = vi.fn(function browserFetch() { receiver = this; return Promise.resolve({ ok: true, json: async () => ({ status: 'success' }) }); });
    await new MySqlExecutionClient({ fetchImpl, tokenProvider: async () => null }).execute({ source: 'SELECT 1;', execution: { publicStandalone: true } });
    expect(receiver).toBeUndefined();
  });

  it('authenticates and maps the remote response to the shared database result shape', async () => {
    const result = { status: 'success', output: 'value\n1', errors: [], database: { dialect: 'mysql', resultSets: [{ columns: ['value'], rows: [[1]], rowCount: 1 }] } };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => result });
    const client = new MySqlExecutionClient({ fetchImpl, tokenProvider: async () => 'firebase-token' });
    await expect(client.execute({ source: 'SELECT 1 AS value;' })).resolves.toEqual(result);
    expect(fetchImpl).toHaveBeenCalledWith('/api/compiler/mysql/run', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer firebase-token' }),
    }));
  });

  it('requires authentication and supports the shared runtime adapter', async () => {
    const client = new MySqlExecutionClient({ tokenProvider: async () => null, fetchImpl: vi.fn() });
    await expect(client.execute({ source: 'SELECT 1;' })).rejects.toThrow('Sign in');
    const adapter = { execute: vi.fn().mockResolvedValue({ status: 'success' }) };
    await new MySqlRuntime({ client: adapter }).execute({ source: 'SELECT 1;' });
    expect(adapter.execute).toHaveBeenCalledWith({ source: 'SELECT 1;' });
  });

  it('routes explicit standalone MySQL to the public endpoint without requiring auth or setup SQL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'success' }) });
    const client = new MySqlExecutionClient({ fetchImpl, tokenProvider: async () => null });
    await client.execute({ source: 'SELECT 1;', setupSql: 'CREATE TABLE hidden(id INT);', execution: { publicStandalone: true } });
    expect(fetchImpl).toHaveBeenCalledWith('/api/compiler/mysql/public', expect.objectContaining({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: 'SELECT 1;' }) }));
  });
});

describe('MySQL script and result policy', () => {
  it('splits multiple statements while preserving semicolons in strings and comments', () => {
    expect(splitMySqlStatements("SELECT ';' AS value; -- ; ignored\nSELECT 2;")).toHaveLength(2);
  });

  it.each(['CREATE USER learner IDENTIFIED BY \'x\';', 'GRANT ALL ON *.* TO learner;', "SELECT 'x' INTO OUTFILE '/tmp/x';", "SELECT LOAD_FILE('/etc/passwd');", 'SET GLOBAL max_connections=1;', 'SHUTDOWN;', 'USE mysql;'])(
    'blocks risky administrative SQL: %s',
    (source) => expect(() => validateMySqlScript(source)).toThrow(MySqlExecutionError),
  );

  it('does not mistake dangerous words inside values for administrative SQL', () => {
    expect(validateMySqlScript("SELECT 'CREATE USER and SHUTDOWN are lessons' AS topic;")).toHaveLength(1);
  });

  it('preserves NULL and serializes bigint, decimal strings, dates, and blobs safely', () => {
    const date = new Date('2026-09-23T00:00:00.000Z');
    const normalized = normalizeMySqlStatementResult(
      [{ missing: null, large: 9007199254740993n, amount: '12.3400', created: date, bytes: Buffer.from([1, 2]) }],
      [{ name: 'missing' }, { name: 'large' }, { name: 'amount' }, { name: 'created' }, { name: 'bytes' }],
      'SELECT values', 1,
    );
    expect(normalized.resultSet.rows[0]).toEqual([
      null,
      { type: 'bigint', value: '9007199254740993' },
      '12.3400',
      { type: 'datetime', value: '2026-09-23T00:00:00.000Z' },
      { type: 'blob', encoding: 'base64', value: 'AQI=' },
    ]);
  });

  it('reports explicit transport truncation metadata', () => {
    const normalized = normalizeMySqlStatementResult([{ id: 1 }, { id: 2 }], [{ name: 'id' }], 'SELECT id', 1);
    expect(normalized.resultSet).toEqual(expect.objectContaining({ rows: [[1]], rowCount: 1, returnedRows: 1, truncated: true }));
  });

  it('bounds huge cells and the aggregate result transport budget', () => {
    const budget = { remaining: 12 };
    const normalized = normalizeMySqlStatementResult(
      [{ first: 'x'.repeat(100), second: 'y'.repeat(100) }],
      [{ name: 'first' }, { name: 'second' }],
      'SELECT huge values', 10, { byteBudget: budget, cellBytes: 8 },
    );
    expect(normalized.resultSet.rows).toEqual([['xxxxxxxx', 'yyyy']]);
    expect(normalized.resultSet.truncated).toBe(true);
    expect(budget.remaining).toBe(0);
  });
});

function fakeInfrastructure() {
  const adminQueries = [];
  const connections = [];
  const adminPool = { query: vi.fn(async (sql) => { adminQueries.push(sql); return [[], []]; }) };
  const executionConnectionFactory = vi.fn(async ({ database, user }) => {
    const connection = {
      database,
      user,
      query: vi.fn(async (sql) => {
        if (/^SET SESSION/.test(sql)) return [{ affectedRows: 0 }, []];
        if (/^SELECT/.test(sql)) return [[{ sandbox: connection.database, missing: null }], [{ name: 'sandbox' }, { name: 'missing' }]];
        if (/^INSERT/.test(sql)) return [{ affectedRows: 2 }, []];
        return [{ affectedRows: 0 }, []];
      }),
      destroy: vi.fn(),
    };
    connections.push(connection);
    return connection;
  });
  return { adminPool, executionConnectionFactory, adminQueries, connections };
}

describe('MySQL sandbox lifecycle', () => {
  it('creates an isolated schema, runs setup separately, and drops the schema after success', async () => {
    const infrastructure = fakeInfrastructure();
    const service = new MySqlSandboxService({ ...infrastructure, now: () => 1_700_000_000_000 });
    const result = await service.execute({ setupSql: 'CREATE TABLE users (id INT);', source: 'INSERT INTO users VALUES (1), (2); SELECT * FROM users;' });
    expect(result).toEqual(expect.objectContaining({ status: 'success', exitCode: 0 }));
    expect(result.database).toEqual(expect.objectContaining({ dialect: 'mysql', affectedRows: 2 }));
    expect(result.database.resultSets[0].rows[0][1]).toBeNull();
    expect(infrastructure.adminQueries[0]).toMatch(/^CREATE DATABASE `yc_sbx_/);
    expect(infrastructure.adminQueries).toEqual(expect.arrayContaining([
      expect.stringMatching(/^CREATE USER 'yc_run_/),
      expect.stringMatching(/^GRANT .* ON `yc_sbx_.*`\.\* TO 'yc_run_/),
      expect.stringMatching(/^DROP DATABASE IF EXISTS `yc_sbx_/),
      expect.stringMatching(/^DROP USER IF EXISTS 'yc_run_/),
    ]));
    expect(result.database.statements).toHaveLength(2);
  });

  it('uses distinct schemas for concurrent executions and cleans both', async () => {
    const infrastructure = fakeInfrastructure();
    let clock = 100;
    const service = new MySqlSandboxService({ ...infrastructure, now: () => clock++ });
    const [first, second] = await Promise.all([
      service.execute({ source: 'SELECT 1 AS value;' }),
      service.execute({ source: 'SELECT 2 AS value;' }),
    ]);
    const schemas = infrastructure.connections.map(({ database }) => database);
    expect(new Set(schemas).size).toBe(2);
    expect(first.database.resultSets[0].rows[0][0]).not.toBe(second.database.resultSets[0].rows[0][0]);
    expect(infrastructure.adminQueries.filter((sql) => /^DROP DATABASE/.test(sql))).toHaveLength(2);
  });

  it('drops the sandbox after a query error', async () => {
    const infrastructure = fakeInfrastructure();
    infrastructure.executionConnectionFactory = vi.fn(async () => ({
      query: vi.fn(async (sql) => { if (/^SET SESSION/.test(sql)) return [{ affectedRows: 0 }, []]; throw Object.assign(new Error('Unknown column'), { code: 'ER_BAD_FIELD_ERROR', sqlState: '42S22', sqlMessage: "Unknown column 'missing'" }); }), destroy: vi.fn(),
    }));
    const service = new MySqlSandboxService(infrastructure);
    await expect(service.execute({ source: 'SELECT missing FROM users;' })).rejects.toMatchObject({ code: 'mysql/query-error' });
    expect(infrastructure.adminQueries.some((sql) => /^DROP DATABASE IF EXISTS/.test(sql))).toBe(true);
  });

  it.each([
    ['timeout', false, 'mysql/timeout'],
    ['cancellation', true, 'mysql/cancelled'],
  ])('destroys the connection and cleans the sandbox after %s', async (_name, cancel, expectedCode) => {
    const infrastructure = fakeInfrastructure();
    let rejectQuery;
    const connection = {
      query: vi.fn((sql) => {
        if (/^SET SESSION/.test(sql)) return Promise.resolve([{ affectedRows: 0 }, []]);
        return new Promise((_resolve, reject) => { rejectQuery = reject; });
      }),
      destroy: vi.fn(() => rejectQuery?.(new Error('connection closed'))),
    };
    infrastructure.executionConnectionFactory = vi.fn(async () => connection);
    const controller = new AbortController();
    const service = new MySqlSandboxService({ ...infrastructure, limits: { sourceBytes: 1000, setupBytes: 1000, statements: 5, resultRows: 10, timeoutMs: 5 } });
    const execution = service.execute({ source: 'SELECT SLEEP(20);', signal: controller.signal });
    if (cancel) controller.abort();
    await expect(execution).rejects.toMatchObject({ code: expectedCode });
    expect(connection.destroy).toHaveBeenCalled();
    expect(infrastructure.adminQueries.some((sql) => /^DROP DATABASE IF EXISTS/.test(sql))).toBe(true);
  });

  it('attempts database and user cleanup independently and logs only sanitized categories', async () => {
    const infrastructure = fakeInfrastructure();
    const logger = { error: vi.fn() };
    infrastructure.adminPool.query = vi.fn(async (sql) => {
      infrastructure.adminQueries.push(sql);
      if (/^DROP DATABASE/.test(sql)) throw Object.assign(new Error('private detail'), { code: 'ER_LOCK_WAIT_TIMEOUT' });
      return [[], []];
    });
    await expect(new MySqlSandboxService({ ...infrastructure, logger }).execute({ source: 'SELECT 1;' })).resolves.toMatchObject({ status: 'success' });
    expect(infrastructure.adminQueries.some((sql) => /^DROP USER/.test(sql))).toBe(true);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('ER_LOCK_WAIT_TIMEOUT'));
    expect(logger.error.mock.calls.flat().join(' ')).not.toContain('private detail');
  });

  it('drops the database before its account so view definers cannot orphan users', async () => {
    const infrastructure = fakeInfrastructure();
    await new MySqlSandboxService(infrastructure).execute({ source: 'SELECT 1;' });
    const dropDatabase = infrastructure.adminQueries.findIndex((sql) => /^DROP DATABASE/.test(sql));
    const dropUser = infrastructure.adminQueries.findIndex((sql) => /^DROP USER/.test(sql));
    expect(dropDatabase).toBeGreaterThan(-1);
    expect(dropUser).toBeGreaterThan(dropDatabase);
  });
});

describe('MySQL abuse guard', () => {
  it('bounds per-user rate and global concurrency', async () => {
    let release;
    const pending = new Promise((resolve) => { release = resolve; });
    const guard = new MySqlAbuseGuard({ maxRequests: 1, maxConcurrent: 1, now: () => 100 });
    const first = guard.run('learner-a', () => pending);
    await expect(guard.run('learner-b', async () => true)).rejects.toMatchObject({ code: 'mysql/busy' });
    release(true);
    await expect(first).resolves.toBe(true);
    await expect(guard.run('learner-a', async () => true)).rejects.toMatchObject({ code: 'mysql/rate-limited' });
  });
});

describe('MySQL execution endpoint', () => {
  const response = () => ({ writableEnded: false, setHeader: vi.fn(), status: vi.fn(function status(code) { return { json: (payload) => ({ code, payload }) }; }) });
  const request = (body) => ({ method: 'POST', body, headers: {}, once: vi.fn(), removeListener: vi.fn() });

  it('authenticates, rate-limits, and delegates to the sandbox service', async () => {
    const execute = vi.fn().mockResolvedValue({ status: 'success' });
    const handler = createMySqlExecutionHandler({
      environment: { NODE_ENV: 'test', MYSQL_RUNTIME_ENABLED: 'true' },
      authenticator: { authenticate: vi.fn().mockResolvedValue({ uid: 'learner-1' }) },
      credentialFactory: () => ({ preflight: vi.fn() }),
      serviceFactory: () => ({ execute }),
      abuseGuard: { run: vi.fn((_uid, operation) => operation()) },
    });
    const result = await handler(request({ source: 'SELECT 1;' }), response());
    expect(result).toEqual({ code: 200, payload: { status: 'success' } });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ source: 'SELECT 1;' }));
  });

  it('rejects browser-controlled setup SQL outside the explicit development gate', async () => {
    const handler = createMySqlExecutionHandler({
      environment: { NODE_ENV: 'production', MYSQL_RUNTIME_ENABLED: 'true' },
      authenticator: { authenticate: vi.fn().mockResolvedValue({ uid: 'learner-1' }) },
      credentialFactory: () => ({ preflight: vi.fn() }), serviceFactory: vi.fn(),
    });
    const result = await handler(request({ source: 'SELECT 1;', setupSql: 'CREATE TABLE hidden (id INT);' }), response());
    expect(result).toEqual(expect.objectContaining({ code: 403 }));
  });

  it('never exposes driver infrastructure details in unknown errors', () => {
    expect(publicMySqlError(new Error('connect ECONNREFUSED mysql.internal:3306 user=root'))).toEqual({
      status: 503, body: { error: { code: 'mysql/unavailable', message: 'The MySQL learning runtime is temporarily unavailable.' } },
    });
  });

  it.each([undefined, '', 'false', 'TRUE', '1'])('keeps the endpoint disabled unless the feature flag is exact true: %s', async (flag) => {
    const handler = createMySqlExecutionHandler({
      environment: { NODE_ENV: 'test', MYSQL_RUNTIME_ENABLED: flag },
      authenticator: { authenticate: vi.fn() }, credentialFactory: vi.fn(), serviceFactory: vi.fn(),
    });
    await expect(handler(request({ source: 'SELECT 1;' }), response())).resolves.toEqual(expect.objectContaining({ code: 503 }));
  });

  it('resolves production setup from canonical server content and ignores no browser authority', async () => {
    const execute = vi.fn().mockResolvedValue({ status: 'success' });
    const setupResolver = new MySqlCanonicalSetupResolver({ contentSource: { getMySqlExecutionDefinition: vi.fn().mockResolvedValue({ language: 'mysql', canonicalId: 'lesson-1', contentHash: 'hash', setupSql: 'CREATE TABLE canonical (id INT);' }) } });
    const handler = createMySqlExecutionHandler({
      environment: { NODE_ENV: 'production', MYSQL_RUNTIME_ENABLED: 'true' },
      authenticator: { authenticate: vi.fn().mockResolvedValue({ uid: 'learner-1' }) },
      credentialFactory: () => ({ preflight: vi.fn() }), serviceFactory: () => ({ execute }), setupResolver,
      distributedQuotaFactory: async () => ({ quota: { acquire: async (uid) => ({ uid, leaseId: 'lease' }), release: vi.fn() }, close: vi.fn() }),
      abuseGuard: { run: vi.fn((_uid, operation) => operation()) },
    });
    const result = await handler(request({ source: 'SELECT * FROM canonical;', contentType: 'course', contentId: 'lesson-1' }), response());
    expect(result.code).toBe(200);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ setupSql: 'CREATE TABLE canonical (id INT);' }));
  });
});

function fakeFirestore() {
  const values = new Map();
  const doc = (path) => ({ path, get: async () => ({ exists: values.has(path), data: () => values.get(path) }) });
  return { values, doc, runTransaction: async (callback) => callback({
    get: async ({ path }) => ({ exists: values.has(path), data: () => values.get(path) }),
    set: ({ path }, value) => values.set(path, structuredClone(value)),
  }) };
}

describe('MySQL distributed quota and canonical content', () => {
  it('atomically enforces user/global leases and reclaims expiry without process-local state', async () => {
    const db = fakeFirestore();
    let now = 100;
    const firstInstance = new MySqlDistributedQuota({ db, now: () => now, policy: { maxGlobalActive: 2, maxUserActive: 1, maxRequests: 3, leaseMs: 10 } });
    const secondInstance = new MySqlDistributedQuota({ db, now: () => now, policy: { maxGlobalActive: 2, maxUserActive: 1, maxRequests: 3, leaseMs: 10 } });
    const lease = await firstInstance.acquire('learner-a');
    await expect(secondInstance.acquire('learner-a')).rejects.toMatchObject({ code: 'mysql/busy' });
    await secondInstance.acquire('learner-b');
    await expect(secondInstance.acquire('learner-c')).rejects.toMatchObject({ code: 'mysql/busy' });
    await firstInstance.release(lease);
    now = 111;
    await expect(secondInstance.acquire('learner-a')).resolves.toMatchObject({ uid: 'learner-a' });
  });

  it('resolves published practice, challenge, and course setup from canonical content', async () => {
    const documents = new Map([
      ['practiceQuestions/p1', { published: true, storagePath: 'practice/mysql/p1.json', version: 'v1', contentHash: 'h1' }],
      ['dailyChallenges/c1', { published: true, practiceQuestionId: 'p1' }],
      ['courses/sql-course', { published: true, storagePath: 'course-content/sql-course', version: 'v1', contentIntegrity: { modules: { 'module-1.json': 'h2' } } }],
    ]);
    const files = new Map([
      ['practice/mysql/v1/p1.json', { blocks: [{ type: 'compiler', language: 'mysql', execution: { setupSql: 'CREATE TABLE p (id INT);' } }] }],
      ['course-content/sql-course/v1/course.json', { modules: [{ lessons: [{ id: 'lesson-1' }] }] }],
      ['course-content/sql-course/v1/module-1.json', { lessons: [{ id: 'lesson-1', blocks: [{ type: 'compiler', language: 'mysql', setupSql: 'CREATE TABLE c (id INT);' }] }] }],
    ]);
    const db = { doc: (path) => ({ get: async () => ({ exists: documents.has(path), data: () => documents.get(path) }) }) };
    const source = new FirebaseMySqlContentSource({ db, uid: 'learner', loadJson: async (path) => files.get(path) });
    await expect(source.getMySqlExecutionDefinition({ contentType: 'practice', contentId: 'p1' })).resolves.toMatchObject({ language: 'mysql', canonicalId: 'p1' });
    await expect(source.getMySqlExecutionDefinition({ contentType: 'challenge', contentId: 'c1' })).resolves.toMatchObject({ canonicalId: 'c1' });
    await expect(source.getMySqlExecutionDefinition({ contentType: 'course', contentId: 'sql-course:lesson-1' })).resolves.toMatchObject({ canonicalId: 'sql-course:lesson-1' });
  });
});

describe('MySQL infrastructure hardening', () => {
  it('requires verified TLS in production and exact feature enablement', () => {
    expect(mysqlInfrastructureInternals.runtimeEnabled({ MYSQL_RUNTIME_ENABLED: 'true' })).toBe(true);
    expect(mysqlInfrastructureInternals.runtimeEnabled({ MYSQL_RUNTIME_ENABLED: 'TRUE' })).toBe(false);
    expect(() => mysqlInfrastructureInternals.resolveTls({ NODE_ENV: 'production', MYSQL_SSL: 'false' })).toThrow('verified TLS');
    expect(mysqlInfrastructureInternals.resolveTls({ NODE_ENV: 'production', MYSQL_SSL: 'true', MYSQL_SSL_CA: 'ca' })).toEqual({ rejectUnauthorized: true, ca: 'ca' });
  });

  it('bounds stale cleanup, defaults to dry-run, and ignores foreign databases', async () => {
    const old = 1_700_000_000_000;
    const sandbox = `yc_sbx_${old.toString(36)}_0123456789abcd`;
    const query = vi.fn(async (sql) => sql.startsWith('SHOW')
      ? [[{ Database: sandbox }, { Database: 'yc_sbx_not-ours' }], []]
      : [[{ User: sandbox.replace('yc_sbx_', 'yc_run_') }, { User: 'root' }], []]);
    const result = await cleanStaleMySqlSandboxes({ adminPool: { query }, now: () => old + 7_200_000, logger: {} });
    expect(result).toEqual(expect.objectContaining({ dryRun: true, eligible: 1, usersEligible: 1, dropped: [sandbox] }));
    expect(query).toHaveBeenCalledTimes(2);
    expect(parseSandboxTimestamp(sandbox)).toBe(old);
  });

  it('protects the scheduled janitor and invokes bounded destructive cleanup', async () => {
    const makeResponse = () => ({ status: vi.fn(function status(code) { return { json: (payload) => ({ code, payload }) }; }) });
    const janitor = vi.fn().mockResolvedValue({ dropped: ['one'], droppedUsers: ['one'] });
    const handler = createMySqlJanitorHandler({ environment: { MYSQL_JANITOR_SECRET: 'secret', MYSQL_RUNTIME_ENABLED: 'true' }, poolsFactory: () => ({ adminPool: {} }), janitor });
    const denied = await handler({ method: 'GET', headers: {} }, makeResponse());
    expect(denied.code).toBe(401);
    const accepted = await handler({ method: 'GET', headers: { authorization: 'Bearer secret' } }, makeResponse());
    expect(accepted).toEqual({ code: 200, payload: { status: 'success', databasesDropped: 1, usersDropped: 1 } });
    expect(janitor).toHaveBeenCalledWith(expect.objectContaining({ dryRun: false, maxDrops: 20 }));
  });
});
