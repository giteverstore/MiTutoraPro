import { timingSafeEqual } from 'node:crypto';
import { createMySqlPools } from '../../../server/mysql/mysqlInfrastructure.js';
import { cleanStaleMySqlSandboxes } from '../../../server/mysql/mysqlSandboxJanitor.js';

export const config = { maxDuration: 15 };

function authorized(request, secret) {
  const presented = String(request.headers?.authorization ?? '').replace(/^Bearer\s+/i, '');
  const expected = String(secret ?? '');
  if (!presented || !expected || presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

export function createMySqlJanitorHandler({ environment = process.env, poolsFactory = createMySqlPools, janitor = cleanStaleMySqlSandboxes } = {}) {
  return async function handler(request, response) {
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

export default createMySqlJanitorHandler();
