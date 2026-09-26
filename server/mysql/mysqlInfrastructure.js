import mysql from 'mysql2/promise';
import { MySqlExecutionError } from './MySqlExecutionError.js';
import { MySqlSandboxService } from './MySqlSandboxService.js';

let pools;

function required(environment, name) {
  const value = String(environment[name] || '').trim();
  if (!value) throw new MySqlExecutionError('mysql/unavailable', 'The MySQL learning runtime is not configured.', { status: 503 });
  return value;
}

function runtimeEnabled(environment) {
  return environment.MYSQL_RUNTIME_ENABLED === 'true';
}

function resolveTls(environment) {
  const production = environment.NODE_ENV === 'production';
  if (production && environment.MYSQL_SSL !== 'true') {
    throw new MySqlExecutionError('mysql/unavailable', 'Production MySQL requires verified TLS.', { status: 503 });
  }
  if (environment.MYSQL_SSL !== 'true') return undefined;
  return {
    rejectUnauthorized: true,
    ...(environment.MYSQL_SSL_CA ? { ca: environment.MYSQL_SSL_CA } : {}),
  };
}

function connectionConfig(environment, userKey, passwordKey) {
  return {
    host: required(environment, 'MYSQL_HOST'),
    port: Number(environment.MYSQL_PORT || 3306),
    user: required(environment, userKey),
    password: required(environment, passwordKey),
    ssl: resolveTls(environment),
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: false,
    multipleStatements: false,
    enableKeepAlive: true,
    connectTimeout: Number(environment.MYSQL_CONNECT_TIMEOUT_MS || 5_000),
  };
}

export function createMySqlPools(environment = process.env) {
  if (!runtimeEnabled(environment)) throw new MySqlExecutionError('mysql/unavailable', 'The MySQL learning runtime is not enabled.', { status: 503 });
  if (!pools) {
    const base = connectionConfig(environment, 'MYSQL_ADMIN_USER', 'MYSQL_ADMIN_PASSWORD');
    pools = Object.freeze({
      adminPool: mysql.createPool({
        ...base,
        connectionLimit: 2,
        maxIdle: 1,
        idleTimeout: 30_000,
        waitForConnections: true,
        queueLimit: Number(environment.MYSQL_ADMIN_QUEUE_LIMIT || 8),
      }),
      executionConnectionFactory: ({ database, user, password }) => mysql.createConnection({
        ...base, user, password, database,
      }),
    });
  }
  return pools;
}

export function createMySqlSandboxService(environment = process.env) {
  return new MySqlSandboxService(createMySqlPools(environment));
}

export function resetMySqlPoolsForTests() { pools = undefined; }

export const mysqlInfrastructureInternals = Object.freeze({ runtimeEnabled, resolveTls, connectionConfig });
