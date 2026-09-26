import { createMySqlPools, resetMySqlPoolsForTests } from '../server/mysql/mysqlInfrastructure.js';
import { MySqlSandboxService } from '../server/mysql/MySqlSandboxService.js';

const live = process.argv.includes('--live');
const required = [
  'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_ADMIN_USER', 'MYSQL_ADMIN_PASSWORD',
  'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET', 'GOOGLE_WIF_AUDIENCE',
  'GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL', 'MYSQL_JANITOR_SECRET',
];
const errors = [];
if (process.env.MYSQL_RUNTIME_ENABLED !== 'true') errors.push('MYSQL_RUNTIME_ENABLED must equal true.');
if (process.env.MYSQL_SSL !== 'true') errors.push('MYSQL_SSL must equal true in production.');
if (process.env.MYSQL_DISTRIBUTED_QUOTA_ENABLED !== 'true') errors.push('MYSQL_DISTRIBUTED_QUOTA_ENABLED must equal true.');
for (const name of required) if (!String(process.env[name] ?? '').trim()) errors.push(`${name} is required.`);
if (!/^\d+$/.test(String(process.env.MYSQL_PORT ?? ''))) errors.push('MYSQL_PORT must be numeric.');
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) errors.push('Production must use OIDC/WIF, not FIREBASE_SERVICE_ACCOUNT_JSON.');
if (Object.keys(process.env).some((name) => name.startsWith('VITE_MYSQL_'))) errors.push('MySQL configuration must never use VITE_ variables.');
if (errors.length) {
  console.error(`MySQL production preflight failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

if (live) {
  let pools;
  try {
    pools = createMySqlPools({ ...process.env, NODE_ENV: 'production' });
    const [[engine]] = await pools.adminPool.query('SELECT VERSION() AS version');
    if (!/^8\.4\./.test(String(engine.version))) throw new Error('The configured engine is not MySQL 8.4.x.');
    const [grants] = await pools.adminPool.query('SHOW GRANTS FOR CURRENT_USER()');
    const evidence = grants.map((row) => Object.values(row)[0]).join('\n');
    for (const requiredGrant of ['CREATE USER', 'yc_sbx_%', 'WITH GRANT OPTION']) if (!evidence.includes(requiredGrant)) throw new Error(`Administrative grant evidence is missing ${requiredGrant}.`);
    for (const forbidden of ['SUPER', 'FILE', 'SHUTDOWN', 'SYSTEM_USER']) if (new RegExp(`\\b${forbidden}\\b`).test(evidence)) throw new Error(`Administrative identity has forbidden ${forbidden} privilege.`);
    const result = await new MySqlSandboxService(pools).execute({ source: 'SELECT 1 AS preflight_value;' });
    if (result.database.resultSets[0]?.rows[0]?.[0] !== 1) throw new Error('Sandbox probe did not return the expected result.');
    const [[databases], [users]] = await Promise.all([
      pools.adminPool.query("SHOW DATABASES LIKE 'yc\\_sbx\\_%'"),
      pools.adminPool.query("SELECT User FROM mysql.user WHERE User LIKE 'yc\\_run\\_%'"),
    ]);
    if (databases.length || users.length) throw new Error('The live preflight left temporary MySQL resources.');
    console.log(`MySQL production live preflight passed with MySQL ${engine.version}.`);
  } finally {
    await pools?.adminPool?.end().catch(() => undefined);
    resetMySqlPoolsForTests();
  }
} else {
  console.log('MySQL production configuration preflight passed (non-destructive static mode).');
}
