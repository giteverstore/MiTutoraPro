import { mysqlSandboxInternals } from './MySqlSandboxService.js';

const DATABASE_PATTERN = /^yc_sbx_([a-z0-9]+)_([a-f0-9]{14})$/;
const USER_PATTERN = /^yc_run_([a-z0-9]+)_([a-f0-9]{14})$/;

export function parseSandboxTimestamp(database) {
  const match = String(database ?? '').match(DATABASE_PATTERN) ?? String(database ?? '').match(USER_PATTERN);
  if (!match) return null;
  const timestamp = Number.parseInt(match[1], 36);
  return Number.isSafeInteger(timestamp) ? timestamp : null;
}

export async function cleanStaleMySqlSandboxes({
  adminPool,
  now = Date.now,
  maxAgeMs = 60 * 60 * 1000,
  maxDrops = 20,
  dryRun = true,
  logger = console,
} = {}) {
  if (!adminPool) throw new Error('MySQL janitor requires an administrative pool.');
  const [rows] = await adminPool.query("SHOW DATABASES LIKE 'yc\\_sbx\\_%'");
  const [userRows] = await adminPool.query("SELECT User FROM mysql.user WHERE User LIKE 'yc\\_run\\_%'");
  const cutoff = now() - maxAgeMs;
  const candidates = rows
    .map((row) => Object.values(row)[0])
    .map((database) => ({ database, timestamp: parseSandboxTimestamp(database) }))
    .filter(({ timestamp }) => timestamp !== null && timestamp < cutoff)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(0, Math.max(0, maxDrops));

  const dropped = [];
  for (const { database } of candidates) {
    const user = database.replace(/^yc_sbx_/, 'yc_run_');
    if (!dryRun) {
      await adminPool.query(`DROP DATABASE IF EXISTS ${mysqlSandboxInternals.quoteIdentifier(database)}`);
      await adminPool.query(`DROP USER IF EXISTS ${mysqlSandboxInternals.quoteAccount(user)}`);
    }
    dropped.push(database);
    logger.info?.(JSON.stringify({ component: 'mysql-janitor', event: dryRun ? 'stale-found' : 'stale-dropped', sandbox: database }));
  }
  const userCandidates = userRows
    .map((row) => row.User)
    .map((user) => ({ user, timestamp: parseSandboxTimestamp(user) }))
    .filter(({ timestamp }) => timestamp !== null && timestamp < cutoff)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(0, Math.max(0, maxDrops));
  const droppedUsers = [];
  for (const { user } of userCandidates) {
    if (!dryRun) await adminPool.query(`DROP USER IF EXISTS ${mysqlSandboxInternals.quoteAccount(user)}`);
    droppedUsers.push(user);
    logger.info?.(JSON.stringify({ component: 'mysql-janitor', event: dryRun ? 'stale-user-found' : 'stale-user-dropped' }));
  }
  return Object.freeze({ dryRun, scanned: rows.length, usersScanned: userRows.length, eligible: candidates.length, usersEligible: userCandidates.length, dropped, droppedUsers });
}
