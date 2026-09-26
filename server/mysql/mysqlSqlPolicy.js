import { MySqlExecutionError } from './MySqlExecutionError.js';

export const MYSQL_LIMITS = Object.freeze({
  sourceBytes: 65_536,
  setupBytes: 65_536,
  statements: 50,
  resultRows: 1_000,
  resultBytes: 512 * 1_024,
  resultCellBytes: 128 * 1_024,
  timeoutMs: 10_000,
});

export function splitMySqlStatements(source) {
  const statements = [];
  let current = '';
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    current += char;
    if (lineComment) { if (char === '\n') lineComment = false; continue; }
    if (blockComment) { if (char === '*' && next === '/') { current += next; index += 1; blockComment = false; } continue; }
    if (quote) {
      if (char === '\\') { if (next) { current += next; index += 1; } }
      else if (char === quote && next === quote) { current += next; index += 1; }
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '-' && next === '-' && /\s/.test(source[index + 2] ?? '')) { current += next; index += 1; lineComment = true; continue; }
    if (char === '#') { lineComment = true; continue; }
    if (char === '/' && next === '*') { current += next; index += 1; blockComment = true; continue; }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === ';') { if (current.trim()) statements.push(current.trim()); current = ''; }
  }
  if (quote || blockComment) throw new MySqlExecutionError('mysql/invalid-sql', 'MySQL error: the SQL script contains an unterminated quote or comment.');
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function policyView(statement) {
  return statement
    .replace(/'(?:\\.|''|[^'])*'/gs, "''")
    .replace(/"(?:\\.|""|[^"])*"/gs, '""')
    .replace(/`(?:``|[^`])*`/gs, '``')
    .replace(/--\s[^\n]*/g, ' ')
    .replace(/#[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PROHIBITED = /\b(?:CREATE|ALTER|DROP)\s+USER\b|\b(?:GRANT|REVOKE|SHUTDOWN|KILL)\b|\bLOAD\s+DATA\b|\bLOAD_FILE\s*\(|\bINTO\s+(?:OUTFILE|DUMPFILE)\b|\bINSTALL\s+(?:PLUGIN|COMPONENT)\b|\b(?:CREATE|ALTER|DROP)\s+(?:DATABASE|SCHEMA)\b|\bLOCK\s+INSTANCE\b|\bSET\s+(?:GLOBAL|PERSIST)\b|^\s*USE\b/i;

export function validateMySqlScript(source, { maxBytes = MYSQL_LIMITS.sourceBytes, maxStatements = MYSQL_LIMITS.statements } = {}) {
  const normalized = String(source ?? '');
  if (Buffer.byteLength(normalized, 'utf8') > maxBytes) throw new MySqlExecutionError('mysql/source-too-large', 'The MySQL script is too large to run.', { status: 413 });
  const statements = splitMySqlStatements(normalized);
  if (!statements.length) throw new MySqlExecutionError('mysql/empty-query', 'Enter a MySQL query to run.');
  if (statements.length > maxStatements) throw new MySqlExecutionError('mysql/too-many-statements', `Run no more than ${maxStatements} statements at once.`);
  for (const statement of statements) {
    if (PROHIBITED.test(policyView(statement))) throw new MySqlExecutionError('mysql/statement-not-allowed', 'This administrative MySQL statement is not available in the learning sandbox.', { status: 403 });
    const limit = policyView(statement).match(/\bLIMIT\s+(?:\d+\s*,\s*)?(\d+)\b/i);
    if (limit && Number(limit[1]) > MYSQL_LIMITS.resultRows) throw new MySqlExecutionError('mysql/result-limit', `MySQL query results are limited to ${MYSQL_LIMITS.resultRows} rows.`);
  }
  return statements;
}
