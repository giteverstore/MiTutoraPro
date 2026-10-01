import { timingSafeEqual } from 'node:crypto';
import {
  assertAllowedOrigin,
  assertJsonPost,
  authorizedSecret,
  cleanupExpiredCompilerPublicData,
  cleanupExpiredRateLimits,
  createCompilerPublicDependencies,
  createFeedback,
  createShare,
  readShare,
  sendCompilerPublicError,
} from './compilerPublicService.js';
import { createRemoteCompilerExecutionHandler } from '../remote-compiler/remoteCompilerExecutionHandler.js';
import { createPublicRemoteCompilerHandler } from '../remote-compiler/publicRemoteCompilerHandler.js';
import { cleanupExpiredPublicRemoteQuotas } from '../remote-compiler/PublicRemoteCompilerQuota.js';
import { createMySqlExecutionHandler } from '../mysql/mysqlExecutionHandler.js';
import { createPublicMySqlExecutionHandler } from '../mysql/publicMySqlExecutionHandler.js';
import { cleanupExpiredPublicMySqlQuotas } from '../mysql/PublicMySqlQuota.js';
import { createMySqlPools } from '../mysql/mysqlInfrastructure.js';
import { cleanStaleMySqlSandboxes } from '../mysql/mysqlSandboxJanitor.js';

function createShareHandler(dependencyFactory) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    let dependencies;
    try {
      assertJsonPost(request);
      dependencies = await dependencyFactory({ request });
      return response.status(201).json(await createShare({ ...dependencies, request, body: request.body }));
    } catch (error) {
      return sendCompilerPublicError(response, error);
    } finally {
      await Promise.resolve(dependencies?.close?.()).catch(() => undefined);
    }
  };
}

function createShareReadHandler(shareId, dependencyFactory) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    let dependencies;
    try {
      if (request.method !== 'GET') return response.status(405).json({ error: { code: 'compiler-public/method-not-allowed', message: 'Method not allowed.' } });
      assertAllowedOrigin(request);
      dependencies = await dependencyFactory({ request });
      return response.status(200).json(await readShare({ ...dependencies, shareId }));
    } catch (error) {
      return sendCompilerPublicError(response, error);
    } finally {
      await Promise.resolve(dependencies?.close?.()).catch(() => undefined);
    }
  };
}

function createFeedbackHandler(dependencyFactory) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    let dependencies;
    try {
      assertJsonPost(request);
      dependencies = await dependencyFactory({ request });
      await createFeedback({ ...dependencies, request, body: request.body });
      return response.status(201).json({ success: true });
    } catch (error) {
      return sendCompilerPublicError(response, error);
    } finally {
      await Promise.resolve(dependencies?.close?.()).catch(() => undefined);
    }
  };
}

function createShareJanitorHandler(dependencyFactory) {
  return async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    let dependencies;
    try {
      const expected = process.env.COMPILER_PUBLIC_JANITOR_SECRET || process.env.CRON_SECRET;
      if (!authorizedSecret(request.headers.authorization, expected)) return response.status(401).json({ error: { code: 'compiler-public/unauthenticated', message: 'Unauthorized.' } });
      dependencies = await dependencyFactory({ request });
      const { db } = dependencies;
      const shares = await cleanupExpiredCompilerPublicData(db);
      const rateLimits = await cleanupExpiredRateLimits(db);
      const remoteRateLimits = await cleanupExpiredPublicRemoteQuotas(db);
      const mysqlRateLimits = await cleanupExpiredPublicMySqlQuotas(db);
      return response.status(200).json({ deletedShares: shares.deleted, deletedRateLimits: rateLimits.deleted, deletedRemoteRateLimits: remoteRateLimits.deleted, deletedMysqlRateLimits: mysqlRateLimits.deleted });
    } catch (error) {
      return sendCompilerPublicError(response, error);
    } finally {
      await Promise.resolve(dependencies?.close?.()).catch(() => undefined);
    }
  };
}

function authorized(request, secret) {
  const presented = String(request.headers?.authorization ?? '').replace(/^Bearer\s+/i, '');
  const expected = String(secret ?? '');
  if (!presented || !expected || presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

export function createMySqlJanitorHandler({ environment = process.env, poolsFactory = createMySqlPools, janitor = cleanStaleMySqlSandboxes } = {}) {
  return async (request, response) => {
    if (request.method !== 'GET') return response.status(405).json({ error: { code: 'mysql/method-not-allowed' } });
    if (!authorized(request, environment.MYSQL_JANITOR_SECRET || environment.CRON_SECRET)) return response.status(401).json({ error: { code: 'mysql/unauthenticated' } });
    try {
      const result = await janitor({ adminPool: poolsFactory(environment).adminPool, dryRun: false, maxDrops: 20 });
      return response.status(200).json({ status: 'success', databasesDropped: result.dropped.length, usersDropped: result.droppedUsers.length });
    } catch {
      return response.status(503).json({ error: { code: 'mysql/unavailable', message: 'MySQL cleanup is temporarily unavailable.' } });
    }
  };
}

function normalizedSegments(request) {
  const queryPath = request.query?.path;
  if (Array.isArray(queryPath)) return queryPath.filter(Boolean).map(String);
  if (typeof queryPath === 'string') return queryPath.split('/').filter(Boolean);
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  return pathname.replace(/^\/api\/compiler\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function createCompilerApiRouter({ dependencyFactory = createCompilerPublicDependencies } = {}) {
  const handlers = new Map([
    ['execute', createRemoteCompilerExecutionHandler()],
    ['feedback', createFeedbackHandler(dependencyFactory)],
    ['mysql/janitor', createMySqlJanitorHandler()],
    ['mysql/public', createPublicMySqlExecutionHandler()],
    ['mysql/run', createMySqlExecutionHandler()],
    ['remote/public', createPublicRemoteCompilerHandler()],
    ['share', createShareHandler(dependencyFactory)],
    ['share/janitor', createShareJanitorHandler(dependencyFactory)],
  ]);

  return async function compilerApiRouter(request, response) {
    const segments = normalizedSegments(request);
    const route = segments.join('/');
    const handler = handlers.get(route);
    if (handler) return handler(request, response);
    if (segments.length === 2 && segments[0] === 'share') return createShareReadHandler(segments[1], dependencyFactory)(request, response);
    response.setHeader('Cache-Control', 'no-store');
    return response.status(404).json({ error: { code: 'compiler/not-found', message: 'Compiler API route not found.' } });
  };
}
