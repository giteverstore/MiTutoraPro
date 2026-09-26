function truncateUtf8(value, maxBytes) {
  const encoded = Buffer.from(value, 'utf8');
  if (encoded.byteLength <= maxBytes) return { value, truncated: false };
  let end = Math.max(0, maxBytes);
  while (end > 0 && (encoded[end] & 0xC0) === 0x80) end -= 1;
  return { value: encoded.subarray(0, end).toString('utf8'), truncated: true };
}

function serializeMySqlValue(value, maxBytes) {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return { type: 'bigint', value: String(value) };
  if (value instanceof Date) return { type: 'datetime', value: value.toISOString() };
  if (Buffer.isBuffer(value)) return { type: 'blob', encoding: 'base64', value: value.toString('base64') };
  return String(value);
}

function boundedValue(value, maxBytes) {
  const serialized = serializeMySqlValue(value);
  if (typeof serialized === 'string') return truncateUtf8(serialized, maxBytes);
  if (serialized?.type === 'blob') {
    const bounded = truncateUtf8(serialized.value, maxBytes);
    return { value: { ...serialized, value: bounded.value }, truncated: bounded.truncated };
  }
  return { value: serialized, truncated: false };
}

export function normalizeMySqlStatementResult(rows, fields, sql, rowLimit, options = {}) {
  if (Array.isArray(rows)) {
    const byteBudget = options.byteBudget;
    const cellBytes = Number(options.cellBytes) || Number.POSITIVE_INFINITY;
    let truncated = rows.length > rowLimit;
    const returned = rows.slice(0, rowLimit);
    const columns = (fields ?? []).map(({ name }) => name);
    const boundedRows = [];
    for (const row of returned) {
      const boundedRow = [];
      for (const column of columns) {
        const remaining = byteBudget ? Math.max(0, byteBudget.remaining) : Number.POSITIVE_INFINITY;
        const bounded = boundedValue(row[column], Math.min(cellBytes, remaining));
        const bytes = Buffer.byteLength(typeof bounded.value === 'object' ? JSON.stringify(bounded.value) : String(bounded.value ?? ''), 'utf8');
        if (byteBudget) byteBudget.remaining = Math.max(0, byteBudget.remaining - bytes);
        boundedRow.push(bounded.value);
        truncated ||= bounded.truncated || (byteBudget?.remaining === 0);
      }
      boundedRows.push(boundedRow);
      if (byteBudget?.remaining === 0) break;
    }
    return {
      statement: { sql, affectedRows: 0, columns, rowCount: boundedRows.length },
      resultSet: {
        columns,
        rows: boundedRows,
        rowCount: boundedRows.length,
        returnedRows: boundedRows.length,
        truncated,
      },
    };
  }
  const affectedRows = Number(rows?.affectedRows ?? 0);
  return { statement: { sql, affectedRows, columns: [], rowCount: 0 }, resultSet: null };
}

export function formatMySqlOutput(database) {
  if (database.resultSets.length) {
    return database.resultSets.map((set, index) => {
      const heading = database.resultSets.length > 1 ? `Result ${index + 1}\n` : '';
      const rows = set.rows.map((row) => row.map((value) => value === null ? 'NULL' : typeof value === 'object' ? value.value : value).join('\t'));
      return `${heading}${set.columns.join('\t')}\n${rows.join('\n')}`.trim();
    }).join('\n\n');
  }
  return database.affectedRows ? `${database.affectedRows} row${database.affectedRows === 1 ? '' : 's'} affected.` : 'Query executed successfully.';
}
