import { randomBytes } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createMySqlPools } from '../../server/mysql/mysqlInfrastructure.js';
import { MySqlSandboxService, mysqlSandboxInternals } from '../../server/mysql/MySqlSandboxService.js';
import { cleanStaleMySqlSandboxes } from '../../server/mysql/mysqlSandboxJanitor.js';

const integration = process.env.MYSQL_INTEGRATION_TEST === 'true' ? describe : describe.skip;
let pools;
let service;

integration('MySQL 8 sandbox integration', () => {
  beforeAll(() => {
    pools = createMySqlPools(process.env);
    service = new MySqlSandboxService(pools);
  });

  afterAll(async () => {
    await Promise.allSettled([pools?.adminPool.end()]);
  });

  afterEach(async () => {
    const [databases] = await pools.adminPool.query("SHOW DATABASES LIKE 'yc\\_sbx\\_%'");
    const [users] = await pools.adminPool.query("SELECT User FROM mysql.user WHERE User LIKE 'yc\\_run\\_%'");
    const [connections] = await pools.adminPool.query("SELECT ID FROM information_schema.PROCESSLIST WHERE USER LIKE 'yc\\_run\\_%'");
    expect(databases).toHaveLength(0);
    expect(users).toHaveLength(0);
    expect(connections).toHaveLength(0);
  });

  it('runs the required MySQL 8.4 engine and exposes the intended administrative grants', async () => {
    const [[version]] = await pools.adminPool.query('SELECT VERSION() AS version');
    expect(version.version).toMatch(/^8\.4\./);
    const [grants] = await pools.adminPool.query('SHOW GRANTS FOR CURRENT_USER()');
    const text = grants.map((row) => Object.values(row)[0]).join('\n');
    expect(text).toContain('CREATE USER');
    expect(text).toContain('yc_sbx_%');
    expect(text).not.toMatch(/\b(?:SUPER|FILE|SHUTDOWN|SYSTEM_USER)\b/);
  });

  it('supports MySQL tables, AUTO_INCREMENT, joins, aggregates, functions, types, DESCRIBE, SHOW TABLES, NULL, and multiple statements', async () => {
    const result = await service.execute({ source: `
      CREATE TABLE teams (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100));
      CREATE TABLE users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        team_id INT,
        name VARCHAR(100),
        amount DECIMAL(10,2),
        bio TEXT,
        active BOOLEAN,
        created_at DATETIME,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id)
      );
      INSERT INTO teams (name) VALUES ('Engineering'), ('Sales');
      INSERT INTO users (team_id, name, amount, bio, active, created_at) VALUES
        (1, 'Avi', 12.34, NULL, TRUE, '2026-09-23 10:00:00'),
        (1, 'Rahul', 20.00, 'Hello', FALSE, '2026-09-23 11:00:00');
      UPDATE users SET amount = ROUND(amount + 1, 2) WHERE name = 'Avi';
      SELECT teams.name, COUNT(*) AS total, CONCAT(UPPER(users.name), '-', LOWER(teams.name)) AS label,
        users.bio AS raw_bio, COALESCE(users.bio, 'none') AS bio, IFNULL(users.bio, 'missing') AS fallback,
        DATE_FORMAT(users.created_at, '%Y-%m-%d') AS day
      FROM teams JOIN users ON teams.id = users.team_id
      GROUP BY teams.name, users.name, users.bio, users.created_at
      HAVING COUNT(*) >= 1 ORDER BY users.name LIMIT 10;
      DESCRIBE users;
      SHOW TABLES;
      DELETE FROM users WHERE name = 'Nobody';
    ` });
    expect(result.status).toBe('success');
    expect(result.database.resultSets).toHaveLength(3);
    expect(result.database.resultSets[0].rows[0]).toContain(null);
    expect(result.database.resultSets[1].columns).toContain('Field');
    expect(result.database.resultSets[2].rowCount).toBe(2);
    expect(result.database.affectedRows).toBeGreaterThanOrEqual(5);
  });

  it.each([
    ['syntax', 'SELEC 1;'],
    ['unknown table', 'SELECT * FROM missing_table;'],
    ['unknown column', 'CREATE TABLE users (id INT); SELECT missing FROM users;'],
    ['duplicate key', 'CREATE TABLE users (id INT PRIMARY KEY); INSERT INTO users VALUES (1), (1);'],
    ['invalid type', "CREATE TABLE users (id INT); INSERT INTO users VALUES ('not-an-int');"],
  ])('normalizes %s errors and leaves the next sandbox usable', async (_name, source) => {
    await expect(service.execute({ source })).rejects.toMatchObject({ code: 'mysql/query-error' });
    await expect(service.execute({ source: 'SELECT 1 AS value;' })).resolves.toMatchObject({ status: 'success' });
  });

  it('isolates concurrent learners in different schemas', async () => {
    const [alice, bob] = await Promise.all([
      service.execute({ source: "CREATE TABLE users (name VARCHAR(20)); INSERT INTO users VALUES ('Alice'); SELECT name FROM users;" }),
      service.execute({ source: "CREATE TABLE users (name VARCHAR(20)); INSERT INTO users VALUES ('Bob'); SELECT name FROM users;" }),
    ]);
    expect(alice.database.resultSets[0].rows).toEqual([['Alice']]);
    expect(bob.database.resultSets[0].rows).toEqual([['Bob']]);
  });

  it('enforces exact per-run grants, database visibility, cross-sandbox denial, and dangerous-operation denial', async () => {
    const create = async () => {
      const identity = mysqlSandboxInternals.makeSandboxIdentity();
      const database = mysqlSandboxInternals.quoteIdentifier(identity.database);
      const account = mysqlSandboxInternals.quoteAccount(identity.user);
      await pools.adminPool.query(`CREATE DATABASE ${database}`);
      await pools.adminPool.query(`CREATE USER ${account} IDENTIFIED BY '${identity.password}'`);
      await pools.adminPool.query(`GRANT ${mysqlSandboxInternals.LEARNER_PRIVILEGES} ON ${database}.* TO ${account}`);
      const connection = await pools.executionConnectionFactory(identity);
      return { identity, database, account, connection };
    };
    const a = await create();
    const b = await create();
    try {
      await a.connection.query("CREATE TABLE users (name VARCHAR(20)); INSERT INTO users VALUES ('Alice')").catch(async () => {
        await a.connection.query('CREATE TABLE users (name VARCHAR(20))'); await a.connection.query("INSERT INTO users VALUES ('Alice')");
      });
      await b.connection.query('CREATE TABLE users (name VARCHAR(20))'); await b.connection.query("INSERT INTO users VALUES ('Bob')");
      await expect(a.connection.query(`SELECT * FROM ${b.database}.users`)).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
      await expect(b.connection.query(`SELECT * FROM ${a.database}.users`)).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
      await expect(a.connection.query(`USE ${b.database}`)).rejects.toBeTruthy();
      await expect(a.connection.query(`SHOW TABLES FROM ${b.database}`)).rejects.toBeTruthy();
      for (const sql of [
        `INSERT INTO ${b.database}.users VALUES ('Mallory')`,
        `UPDATE ${b.database}.users SET name = 'Mallory'`,
        `DELETE FROM ${b.database}.users`,
        `CREATE TABLE ${b.database}.intruder (id INT)`,
        `DROP TABLE ${b.database}.users`,
      ]) await expect(a.connection.query(sql)).rejects.toBeTruthy();
      const [grants] = await a.connection.query('SHOW GRANTS FOR CURRENT_USER()');
      const grantText = grants.map((row) => Object.values(row)[0]).join('\n');
      expect(grantText).toContain(a.identity.database);
      expect(grantText).not.toMatch(/\b(?:FILE|SUPER|CREATE USER|GRANT OPTION|SHUTDOWN|SYSTEM_USER)\b/);
      const [visible] = await a.connection.query('SHOW DATABASES');
      expect(visible.map((row) => row.Database)).toEqual(expect.arrayContaining([a.identity.database, 'information_schema', 'performance_schema']));
      expect(visible.map((row) => row.Database)).not.toContain(b.identity.database);
      for (const sql of ["CREATE USER 'intruder'@'%' IDENTIFIED BY 'x'", "ALTER USER 'root'@'localhost' IDENTIFIED BY 'x'", "DROP USER 'root'@'localhost'", "GRANT SELECT ON *.* TO 'intruder'@'%'", "REVOKE SELECT ON *.* FROM 'root'@'localhost'", 'SET GLOBAL max_connections=10', 'SET PERSIST max_connections=10', 'FLUSH PRIVILEGES', 'LOCK INSTANCE FOR BACKUP', "INSTALL PLUGIN bad SONAME 'bad.dll'", "UNINSTALL PLUGIN validate_password", "CREATE FUNCTION intruder RETURNS STRING SONAME 'bad.so'", 'SHUTDOWN']) {
        await expect(a.connection.query(sql)).rejects.toBeTruthy();
      }
      const [[adminThread]] = await pools.adminPool.query('SELECT CONNECTION_ID() AS id');
      await expect(a.connection.query(`KILL ${adminThread.id}`)).rejects.toBeTruthy();
      const [file] = await a.connection.query("SELECT LOAD_FILE('C:/Windows/win.ini') AS value");
      expect(file[0].value).toBeNull();
      await expect(a.connection.query("SELECT 'x' INTO OUTFILE 'forbidden.txt'")).rejects.toBeTruthy();
      await expect(a.connection.query("SELECT 'x' INTO DUMPFILE 'forbidden.bin'")).rejects.toBeTruthy();
      await expect(a.connection.query("LOAD DATA INFILE 'missing.txt' INTO TABLE users")).rejects.toBeTruthy();
      await expect(a.connection.query("LOAD DATA LOCAL INFILE 'missing.txt' INTO TABLE users")).rejects.toBeTruthy();
      await expect(a.connection.query('SELECT * FROM mysql.user')).rejects.toBeTruthy();
      await expect(a.connection.query('CREATE TABLE mysql.intruder (id INT)')).rejects.toBeTruthy();
      const [metadata] = await a.connection.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA');
      const schemas = metadata.map((row) => row.SCHEMA_NAME);
      expect(schemas).toContain(a.identity.database);
      expect(schemas).not.toContain(b.identity.database);
    } finally {
      a.connection.destroy(); b.connection.destroy();
      await Promise.allSettled([
        pools.adminPool.query(`DROP DATABASE IF EXISTS ${a.database}`), pools.adminPool.query(`DROP USER IF EXISTS ${a.account}`),
        pools.adminPool.query(`DROP DATABASE IF EXISTS ${b.database}`), pools.adminPool.query(`DROP USER IF EXISTS ${b.account}`),
      ]);
    }
  });

  it('reports hardened server file settings and supports safe sandbox-local objects', async () => {
    const [[settings]] = await pools.adminPool.query("SELECT @@local_infile AS localInfile, @@secure_file_priv AS secureFilePriv");
    expect(Number(settings.localInfile)).toBe(0);
    expect([null, 'NULL']).toContain(settings.secureFilePriv);
    const result = await service.execute({ source: `
      CREATE TABLE base (id INT PRIMARY KEY, value VARCHAR(20));
      CREATE INDEX value_index ON base(value);
      CREATE VIEW base_view AS SELECT id, value FROM base;
      CREATE TEMPORARY TABLE temp_values (id INT);
      START TRANSACTION;
      INSERT INTO base VALUES (1, 'committed');
      INSERT INTO temp_values VALUES (1);
      COMMIT;
      SELECT * FROM base_view;
      SELECT * FROM temp_values;
    ` });
    expect(result.database.resultSets.map((set) => set.rows)).toEqual([[[1, 'committed']], [[1]]]);
  });

  it('caps large row sets and huge cells without leaking resources', async () => {
    const rows = await service.execute({ source: `
      CREATE TABLE digits (n INT);
      INSERT INTO digits VALUES (0),(1),(2),(3),(4),(5),(6),(7),(8),(9);
      SELECT a.n FROM digits a CROSS JOIN digits b CROSS JOIN digits c CROSS JOIN digits d;
    ` });
    expect(rows.database.resultSets[0]).toMatchObject({ returnedRows: 1000, truncated: true });
    const cell = await service.execute({ source: "SELECT REPEAT('x', 1048576) AS payload;" });
    expect(cell.database.truncated).toBe(true);
    expect(Buffer.byteLength(cell.database.resultSets[0].rows[0][0], 'utf8')).toBeLessThanOrEqual(128 * 1024);
    expect(Buffer.byteLength(JSON.stringify(cell), 'utf8')).toBeLessThan(1_100_000);
  });

  it('drops transaction state after failure and exposes useful sanitized diagnostics', async () => {
    await expect(service.execute({ source: `
      CREATE TABLE items (id INT PRIMARY KEY);
      START TRANSACTION;
      INSERT INTO items VALUES (1);
      INSERT INTO items VALUES (1);
    ` })).rejects.toMatchObject({
      code: 'mysql/query-error',
      message: expect.stringContaining('ER_DUP_ENTRY'),
    });
    await expect(service.execute({ source: 'SELECT * FROM items;' })).rejects.toMatchObject({
      code: 'mysql/query-error',
      message: expect.stringContaining('ER_NO_SUCH_TABLE'),
    });
  });

  it('preserves transactions and precision-safe/binary/date serialization', async () => {
    const result = await service.execute({ source: `
      CREATE TABLE values_table (id INT PRIMARY KEY, big BIGINT, amount DECIMAL(30,9), day DATE, moment DATETIME, stamp TIMESTAMP, bytes BLOB);
      INSERT INTO values_table VALUES (1, 9223372036854775807, 12345678901234567890.123456789, '2026-09-24', '2026-09-24 10:11:12', '2026-09-24 10:11:12', X'0102');
      START TRANSACTION; UPDATE values_table SET id = 2; ROLLBACK;
      START TRANSACTION; UPDATE values_table SET amount = amount + 1 WHERE id = 1; COMMIT;
      WITH selected AS (SELECT * FROM values_table WHERE id IN (SELECT id FROM values_table)) SELECT * FROM selected;
    ` });
    const row = result.database.resultSets[0].rows[0];
    expect(row[1]).toBe('9223372036854775807');
    expect(row[2]).toBe('12345678901234567891.123456789');
    expect(row[3]).toEqual(expect.objectContaining({ type: 'datetime' }));
    expect(row[6]).toEqual({ type: 'blob', encoding: 'base64', value: 'AQI=' });
  });

  it('terminates a server-side timeout and supports a clean subsequent execution', async () => {
    await expect(service.execute({ source: 'SELECT SLEEP(20);' })).rejects.toMatchObject({ code: 'mysql/timeout' });
    await expect(service.execute({ source: 'SELECT 1 AS value;' })).resolves.toMatchObject({ status: 'success' });
  });

  it('cancels a real active query, cleans it, and supports immediate recovery', async () => {
    const controller = new AbortController();
    const pending = service.execute({ source: 'SELECT SLEEP(20);', signal: controller.signal });
    setTimeout(() => controller.abort(), 100);
    await expect(pending).rejects.toMatchObject({ code: 'mysql/cancelled' });
    await expect(service.execute({ source: 'SELECT 1 AS value;' })).resolves.toMatchObject({ status: 'success' });
  });

  it('contains lock contention and leaves capacity usable after connection cleanup', async () => {
    const identity = mysqlSandboxInternals.makeSandboxIdentity();
    const database = mysqlSandboxInternals.quoteIdentifier(identity.database);
    const account = mysqlSandboxInternals.quoteAccount(identity.user);
    let first;
    let second;
    try {
      await pools.adminPool.query(`CREATE DATABASE ${database}`);
      await pools.adminPool.query(`CREATE USER ${account} IDENTIFIED BY '${identity.password}'`);
      await pools.adminPool.query(`GRANT ${mysqlSandboxInternals.LEARNER_PRIVILEGES} ON ${database}.* TO ${account}`);
      first = await pools.executionConnectionFactory(identity);
      second = await pools.executionConnectionFactory(identity);
      await first.query('CREATE TABLE locks (id INT PRIMARY KEY, value INT);');
      await first.query('INSERT INTO locks VALUES (1, 1);');
      await first.query('START TRANSACTION');
      await first.query('UPDATE locks SET value = 2 WHERE id = 1');
      await second.query('SET SESSION innodb_lock_wait_timeout = 1');
      await expect(second.query('UPDATE locks SET value = 3 WHERE id = 1')).rejects.toMatchObject({ code: 'ER_LOCK_WAIT_TIMEOUT' });
    } finally {
      first?.destroy();
      second?.destroy();
      await pools.adminPool.query(`DROP DATABASE IF EXISTS ${database}`);
      await pools.adminPool.query(`DROP USER IF EXISTS ${account}`);
    }
    await expect(service.execute({ source: 'SELECT 1 AS value;' })).resolves.toMatchObject({ status: 'success' });
  });

  it('bounds maximum-size multi-statement execution', async () => {
    const source = Array.from({ length: 50 }, (_, index) => `SELECT ${index} AS value`).join(';');
    const result = await service.execute({ source });
    expect(result.database.resultSets).toHaveLength(50);
    await expect(service.execute({ source: `${source};SELECT 50 AS value` })).rejects.toMatchObject({ code: 'mysql/too-many-statements' });
  });

  it('handles four simultaneous isolated executions without pool deadlock', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, (_, index) => service.execute({ source: `SELECT ${index} AS value;` })));
    expect(results.map((result) => result.database.resultSets[0].rows[0][0])).toEqual(['0', '1', '2', '3']);
  });

  it('dry-runs and then removes stale generated databases and users without touching unrelated resources', async () => {
    const identity = mysqlSandboxInternals.makeSandboxIdentity(() => 100);
    const database = mysqlSandboxInternals.quoteIdentifier(identity.database);
    const account = mysqlSandboxInternals.quoteAccount(identity.user);
    await pools.adminPool.query(`CREATE DATABASE ${database}`);
    await pools.adminPool.query(`CREATE USER ${account} IDENTIFIED BY '${identity.password}'`);
    const dry = await cleanStaleMySqlSandboxes({ adminPool: pools.adminPool, now: () => 7_200_100, maxAgeMs: 3_600_000, dryRun: true, logger: {} });
    expect(dry).toMatchObject({ eligible: 1, usersEligible: 1 });
    const removed = await cleanStaleMySqlSandboxes({ adminPool: pools.adminPool, now: () => 7_200_100, maxAgeMs: 3_600_000, dryRun: false, logger: {} });
    expect(removed).toMatchObject({ dropped: [identity.database], droppedUsers: [identity.user] });
  });
});
