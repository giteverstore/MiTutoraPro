import { MySqlRuntime } from '../runtimes/mysql/MySqlRuntime.js';

export const mysqlLanguage = Object.freeze({
  id: 'mysql',
  label: 'MySQL',
  category: 'data',
  categoryOrder: 2,
  selectorOrder: 17,
  monacoLanguage: 'sql',
  defaultFileName: 'query.sql',
  executionMode: 'database',
  defaultSource: `CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255)
);

INSERT INTO users (name, email)
VALUES
  ('Avi', 'avi@example.com'),
  ('Rahul', 'rahul@example.com');

SELECT * FROM users;`,
  createRuntime: () => new MySqlRuntime(),
});
