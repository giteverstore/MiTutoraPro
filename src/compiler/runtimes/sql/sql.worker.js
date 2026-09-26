import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { executeSqlDatabase, formatSqlOutput } from './sqlExecution.js';

let sqlitePromise;
const initialize = () => {
  sqlitePromise ??= sqlite3InitModule({ print: () => {}, printErr: () => {} });
  return sqlitePromise;
};

self.addEventListener('message', async ({ data }) => {
  if (data.type !== 'execute') return;
  const startedAt = performance.now();
  try {
    const sqlite3 = await initialize();
    const database = executeSqlDatabase(sqlite3, data);
    self.postMessage({
      id: data.id,
      type: 'execution',
      status: 'success',
      output: formatSqlOutput(database),
      errors: [],
      executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
      database,
    });
  } catch (error) {
    self.postMessage({
      id: data.id,
      type: 'execution',
      status: 'error',
      output: '',
      errors: [`SQL execution error: ${error.message || String(error)}`],
      executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
      database: { resultSets: [], statements: [], affectedRows: 0 },
    });
  }
});
