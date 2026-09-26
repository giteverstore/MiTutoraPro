function serializeValue(value) {
  if (typeof value === 'bigint') return { type: 'bigint', value: String(value) };
  if (value instanceof Uint8Array) return { type: 'blob', value: Array.from(value) };
  return value;
}

export function splitSqlStatements(source) {
  const statements = [];
  let current = '';
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    current += char;
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { current += next; index += 1; blockComment = false; }
      continue;
    }
    if (quote) {
      if (char === quote && next === quote) { current += next; index += 1; }
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '-' && next === '-') { current += next; index += 1; lineComment = true; continue; }
    if (char === '/' && next === '*') { current += next; index += 1; blockComment = true; continue; }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function executeStatements(db, source, resultSets, statements) {
  for (const sql of splitSqlStatements(String(source ?? ''))) {
    const columns = [];
    const rows = [];
    db.exec({ sql, rowMode: 'array', columnNames: columns, resultRows: rows });
    const mutatesRows = /^\s*(?:insert|update|delete|replace)\b/i.test(sql.replace(/^(?:\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, ''));
    const affectedRows = mutatesRows ? Number(db.changes()) : 0;
    const serializedRows = rows.map((row) => row.map(serializeValue));
    const statement = { sql, affectedRows, columns: [...columns], rowCount: serializedRows.length };
    statements.push(statement);
    if (columns.length) resultSets.push({ columns: [...columns], rows: serializedRows, rowCount: serializedRows.length });
  }
}

export function executeSqlDatabase(sqlite3, { source, setupSql = '' }) {
  const db = new sqlite3.oo1.DB(':memory:', 'ct');
  const resultSets = [];
  const statements = [];
  try {
    if (String(setupSql).trim()) executeStatements(db, setupSql, [], []);
    executeStatements(db, source, resultSets, statements);
    const affectedRows = statements.reduce((total, statement) => total + statement.affectedRows, 0);
    return { resultSets, statements, affectedRows };
  } finally {
    db.close();
  }
}

export function formatSqlOutput({ resultSets, statements, affectedRows }) {
  if (resultSets.length) {
    return resultSets.map((set, index) => {
      const heading = resultSets.length > 1 ? `Result ${index + 1}\n` : '';
      const rows = set.rows.map((row) => row.map((value) => value === null ? 'NULL' : typeof value === 'object' ? value.value : value).join('\t'));
      return `${heading}${set.columns.join('\t')}\n${rows.join('\n')}`.trim();
    }).join('\n\n');
  }
  const executed = statements.length;
  if (affectedRows > 0) return `${affectedRows} row${affectedRows === 1 ? '' : 's'} affected.`;
  return executed ? 'Query executed successfully.' : 'No SQL statements to execute.';
}
