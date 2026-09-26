import { beforeAll, describe, expect, it, vi } from 'vitest';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { executeSqlDatabase, formatSqlOutput, splitSqlStatements } from '../../src/compiler/runtimes/sql/sqlExecution.js';
import { SqlWorkerClient } from '../../src/compiler/runtimes/sql/SqlWorkerClient.js';

let sqlite3;
beforeAll(async () => { sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} }); });

const execute = (source, setupSql = '') => executeSqlDatabase(sqlite3, { source, setupSql });

describe('SQL SQLite runtime', () => {
  it('executes a basic SELECT with structured evidence', () => {
    const result = execute('SELECT 1 AS value;');
    expect(result.resultSets).toEqual([{ columns: ['value'], rows: [[1]], rowCount: 1 }]);
    expect(formatSqlOutput(result)).toBe('value\n1');
  });

  it('runs create, insert, filtering, ordering, and limits sequentially', () => {
    const result = execute(`
      CREATE TABLE users (id INTEGER, name TEXT);
      INSERT INTO users VALUES (1, 'Avi'), (2, 'Rahul'), (3, 'Meera');
      SELECT id, name FROM users WHERE id > 1 ORDER BY id DESC LIMIT 2;
    `);
    expect(result.resultSets[0]).toEqual({ columns: ['id', 'name'], rows: [[3, 'Meera'], [2, 'Rahul']], rowCount: 2 });
    expect(result.affectedRows).toBe(3);
  });

  it('supports setup SQL without exposing it as learner statements', () => {
    const result = execute('SELECT name FROM employees ORDER BY salary DESC;', `
      CREATE TABLE employees (name TEXT, salary INTEGER);
      INSERT INTO employees VALUES ('Asha', 80000), ('Meera', 90000);
    `);
    expect(result.resultSets[0].rows).toEqual([['Meera'], ['Asha']]);
    expect(result.statements).toHaveLength(1);
  });

  it('supports joins, aggregates, group by, and having', () => {
    const result = execute(`
      CREATE TABLE teams (id INTEGER, name TEXT);
      CREATE TABLE people (team_id INTEGER, salary INTEGER);
      INSERT INTO teams VALUES (1, 'Engineering'), (2, 'Sales');
      INSERT INTO people VALUES (1, 80), (1, 90), (2, 50);
      SELECT teams.name, COUNT(*) AS total, SUM(salary) AS salary
      FROM teams JOIN people ON teams.id = people.team_id
      GROUP BY teams.name HAVING COUNT(*) > 1;
    `);
    expect(result.resultSets[0].rows).toEqual([['Engineering', 2, 170]]);
  });

  it('preserves NULL and multiple result sets', () => {
    const result = execute("SELECT NULL AS missing; SELECT 'second' AS label;");
    expect(result.resultSets).toHaveLength(2);
    expect(result.resultSets[0].rows).toEqual([[null]]);
    expect(result.resultSets[1].rows).toEqual([['second']]);
  });

  it('supports transactions and returns real affected-row feedback', () => {
    const result = execute(`CREATE TABLE items (id INTEGER); BEGIN; INSERT INTO items VALUES (1), (2); COMMIT;`);
    expect(result.affectedRows).toBe(2);
    expect(formatSqlOutput(result)).toBe('2 rows affected.');
  });

  it('throws concise SQLite errors for invalid SQL and missing columns', () => {
    expect(() => execute('SELEC 1;')).toThrow(/near "SELEC"/i);
    expect(() => execute('CREATE TABLE users (id INTEGER); SELECT missing FROM users;')).toThrow(/no such column/i);
  });

  it('splits semicolons safely inside strings and comments', () => {
    expect(splitSqlStatements("SELECT ';' AS value; -- ; ignored\nSELECT 2;")).toHaveLength(2);
  });

  it('terminates a timed-out worker and allows a later clean execution', async () => {
    const workers = [];
    const workerFactory = () => {
      const listeners = {};
      const worker = { addEventListener: vi.fn((type, callback) => { listeners[type] = callback; }), postMessage: vi.fn(), terminate: vi.fn(), listeners };
      workers.push(worker);
      return worker;
    };
    const client = new SqlWorkerClient({ workerFactory, timeoutMs: 5 });
    await expect(client.execute({ source: 'WITH RECURSIVE loop AS (...) SELECT * FROM loop;' })).rejects.toThrow(/exceeded 5 ms/);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    const next = client.execute({ source: 'SELECT 1;' });
    workers[1].listeners.message({ data: { status: 'success', database: { resultSets: [] } } });
    await expect(next).resolves.toEqual(expect.objectContaining({ status: 'success' }));
    expect(workers[1].terminate).toHaveBeenCalledOnce();
  });
});
