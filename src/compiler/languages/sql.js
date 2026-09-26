import { SqlRuntime } from '../runtimes/sql/SqlRuntime.js';

export const sqlLanguage = Object.freeze({
  id: 'sql',
  label: 'SQL',
  category: 'data',
  categoryOrder: 1,
  selectorOrder: 16,
  monacoLanguage: 'sql',
  defaultFileName: 'query.sql',
  executionMode: 'database',
  defaultSource: `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT
);

INSERT INTO users (name)
VALUES ('Avi'), ('Rahul');

SELECT * FROM users;`,
  createRuntime: () => new SqlRuntime(),
});
