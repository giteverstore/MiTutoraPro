import { randomBytes } from 'node:crypto';
import { MySqlExecutionError } from './MySqlExecutionError.js';
import { MYSQL_LIMITS, validateMySqlScript } from './mysqlSqlPolicy.js';
import { formatMySqlOutput, normalizeMySqlStatementResult } from './mysqlResultNormalization.js';

const SANDBOX_NAME = /^yc_sbx_[a-z0-9_]+$/;

function makeSandboxIdentity(now = Date.now) {
  // MySQL user names are limited to 32 characters. Seven random bytes retain
  // 56 bits of entropy while keeping yc_run_<timestamp>_<random> within 32.
  const suffix = `${now().toString(36)}_${randomBytes(7).toString('hex')}`;
  return Object.freeze({
    database: `yc_sbx_${suffix}`,
    user: `yc_run_${suffix}`,
    password: randomBytes(24).toString('base64url'),
  });
}

function quoteIdentifier(identifier) {
  if (!SANDBOX_NAME.test(identifier)) throw new Error('Invalid generated sandbox identifier.');
  return `\`${identifier}\``;
}

function quoteAccount(user) {
  if (!/^yc_run_[a-z0-9_]+$/.test(user)) throw new Error('Invalid generated execution account.');
  return `'${user}'@'%'`;
}

const LEARNER_PRIVILEGES = 'SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES, CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE, SHOW VIEW, CREATE VIEW';

function publicDriverError(error) {
  if (error instanceof MySqlExecutionError) return error;
  const code = typeof error?.code === 'string' && /^ER_[A-Z0-9_]+$/.test(error.code) ? error.code : undefined;
  const sqlState = typeof error?.sqlState === 'string' && /^[A-Z0-9]{5}$/.test(error.sqlState) ? error.sqlState : undefined;
  const message = String(error?.sqlMessage || error?.message || 'The query could not be executed.')
    .replace(/(?:mysql|tcp):\/\/\S+/gi, '[database]')
    .replace(/\b(?:host|user|password)\s*=\s*\S+/gi, '[redacted]');
  return new MySqlExecutionError('mysql/query-error', `MySQL error${code ? ` (${code})` : ''}${sqlState ? ` [${sqlState}]` : ''}: ${message}`, { status: 400, cause: error });
}

export class MySqlSandboxService {
  constructor({ adminPool, executionConnectionFactory, executionPool, limits = MYSQL_LIMITS, now = Date.now, logger = console } = {}) {
    this.adminPool = adminPool;
    this.executionConnectionFactory = executionConnectionFactory
      ?? (async ({ database }) => {
        const connection = await executionPool.getConnection();
        await connection.changeUser({ database });
        return connection;
      });
    this.limits = limits;
    this.now = now;
    this.logger = logger;
  }

  async execute({ source, setupSql = '', signal }) {
    const statements = validateMySqlScript(source, { maxBytes: this.limits.sourceBytes, maxStatements: this.limits.statements });
    const setupStatements = setupSql ? validateMySqlScript(setupSql, { maxBytes: this.limits.setupBytes, maxStatements: this.limits.statements }) : [];
    const identity = makeSandboxIdentity(this.now);
    const sandbox = identity.database;
    const identifier = quoteIdentifier(sandbox);
    const account = quoteAccount(identity.user);
    let connection;
    let timer;
    let timedOut = false;
    const startedAt = performance.now();
    const deadlineExceeded = () => timedOut || performance.now() - startedAt >= this.limits.timeoutMs;
    try {
      await this.adminPool.query(`CREATE DATABASE ${identifier} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
      await this.adminPool.query(`CREATE USER ${account} IDENTIFIED BY '${identity.password}'`);
      await this.adminPool.query(`GRANT ${LEARNER_PRIVILEGES} ON ${identifier}.* TO ${account}`);
      connection = await this.executionConnectionFactory(identity);
      await connection.query(`SET SESSION MAX_EXECUTION_TIME = ${Number(this.limits.timeoutMs)}, SQL_SELECT_LIMIT = ${Number(this.limits.resultRows + 1)}, SQL_MODE = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'`);
      const abort = () => connection?.destroy();
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      timer = setTimeout(() => { timedOut = true; abort(); }, this.limits.timeoutMs);
      try {
        for (const sql of setupStatements) {
          await connection.query(sql);
          if (deadlineExceeded()) throw new MySqlExecutionError('mysql/timeout', `MySQL execution exceeded ${this.limits.timeoutMs} ms.`, { status: 408 });
        }
        const database = { dialect: 'mysql', resultSets: [], statements: [], affectedRows: 0, truncated: false };
        const byteBudget = { remaining: Number(this.limits.resultBytes ?? MYSQL_LIMITS.resultBytes) };
        for (const sql of statements) {
          const [rows, fields] = await connection.query(sql);
          if (deadlineExceeded()) throw new MySqlExecutionError('mysql/timeout', `MySQL execution exceeded ${this.limits.timeoutMs} ms.`, { status: 408 });
          const normalized = normalizeMySqlStatementResult(rows, fields, sql, this.limits.resultRows, {
            byteBudget,
            cellBytes: this.limits.resultCellBytes ?? MYSQL_LIMITS.resultCellBytes,
          });
          database.statements.push(normalized.statement);
          database.affectedRows += normalized.statement.affectedRows;
          if (normalized.resultSet) {
            database.resultSets.push(normalized.resultSet);
            database.truncated ||= normalized.resultSet.truncated;
          }
        }
        if (signal?.aborted) throw new MySqlExecutionError('mysql/cancelled', 'MySQL execution was cancelled.', { status: 499 });
        const executionTimeMs = Math.max(1, Math.round(performance.now() - startedAt));
        return { type: 'execution', status: 'success', output: formatMySqlOutput(database), errors: [], stderr: '', exitCode: 0, executionTimeMs, database };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    } catch (error) {
      if (signal?.aborted) throw new MySqlExecutionError('mysql/cancelled', 'MySQL execution was cancelled.', { status: 499, cause: error });
      if (timedOut) throw new MySqlExecutionError('mysql/timeout', `MySQL execution exceeded ${this.limits.timeoutMs} ms.`, { status: 408, cause: error });
      throw publicDriverError(error);
    } finally {
      clearTimeout(timer);
      connection?.destroy();
      // A view may reference the ephemeral account as its DEFINER. Drop the
      // database before its account so MySQL cannot reject DROP USER while the
      // view still exists.
      const cleanup = [];
      cleanup.push((await Promise.allSettled([
        this.adminPool.query(`DROP DATABASE IF EXISTS ${identifier}`),
      ]))[0]);
      cleanup.push((await Promise.allSettled([
        this.adminPool.query(`DROP USER IF EXISTS ${account}`),
      ]))[0]);
      cleanup.forEach((outcome, index) => {
        if (outcome.status === 'rejected') this.logger.error?.(JSON.stringify({
          component: 'mysql-sandbox',
          event: 'cleanup-failed',
          resource: index === 0 ? 'database' : 'user',
          code: outcome.reason?.code || 'unknown',
        }));
      });
    }
  }
}

export const mysqlSandboxInternals = Object.freeze({ makeSandboxIdentity, quoteIdentifier, quoteAccount, LEARNER_PRIVILEGES });
