import { ChevronDown, ChevronUp, LoaderCircle } from 'lucide-react';
import { ICON_SIZE } from '../design-system/theme';

const DISPLAY_ROW_LIMIT = 500;

function displayValue(value) {
  if (value === null) return <span className="database-null">NULL</span>;
  if (value && typeof value === 'object' && value.type === 'blob') return <span>Blob ({value.value.length} bytes)</span>;
  if (value && typeof value === 'object' && value.type === 'bigint') return value.value;
  return String(value);
}

export function DatabaseResultPanel({ database, error, isRunning, executionTimeMs, executionStatus, height, collapsed, onExpand, onToggleCollapsed }) {
  const resultSets = database?.resultSets ?? [];
  const status = isRunning ? 'running' : executionStatus;
  return <section className={`database-result-panel ide-results is-${status}${collapsed ? ' is-collapsed' : ''}`} style={{ height, flexBasis: height }} aria-live="polite">
    <div className="ide-result-tabs" role="tablist" aria-label="Database results">
      <button className="is-active" type="button" role="tab" aria-selected="true" onClick={onExpand}>Results</button>
      <button className="output-panel-toggle" type="button" aria-label={collapsed ? 'Restore database results' : 'Minimize database results'} onClick={onToggleCollapsed}>
        {collapsed ? <ChevronUp size={ICON_SIZE.sm} aria-hidden="true" /> : <ChevronDown size={ICON_SIZE.sm} aria-hidden="true" />}
      </button>
    </div>
    {!collapsed ? <div className="database-results-content" role="tabpanel" tabIndex="0">
      {isRunning ? <p className="database-result-message"><LoaderCircle className="result-spinner" size={ICON_SIZE.sm} aria-hidden="true" /> Executing SQL…</p>
        : error ? <div className="database-result-error"><strong>SQL Error</strong><pre><code>{error}</code></pre></div>
          : resultSets.length ? resultSets.map((resultSet, index) => {
            const displayedRows = resultSet.rows.slice(0, DISPLAY_ROW_LIMIT);
            return <section className="database-result-set" key={`result-${index}`}>
              {resultSets.length > 1 ? <h4>Result {index + 1}</h4> : null}
              <div className="database-table-scroll"><table>
                <thead><tr>{resultSet.columns.map((column, columnIndex) => <th key={`${column}-${columnIndex}`} scope="col">{column}</th>)}</tr></thead>
                <tbody>{displayedRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={columnIndex}>{displayValue(value)}</td>)}</tr>)}</tbody>
              </table></div>
              <p>{resultSet.rowCount} row{resultSet.rowCount === 1 ? '' : 's'}{resultSet.rowCount > DISPLAY_ROW_LIMIT ? ` · Showing first ${DISPLAY_ROW_LIMIT} rows` : ''}{resultSet.truncated ? ' · Server result limit reached' : ''}</p>
            </section>;
          }) : <p className="database-result-message">{database ? database.affectedRows > 0 ? `${database.affectedRows} row${database.affectedRows === 1 ? '' : 's'} affected.` : 'Query executed successfully.' : 'Run your SQL to see query results.'}</p>}
    </div> : null}
    {!collapsed ? <footer className="ide-result-footer"><div className="ide-runtime-status"><span className={`ide-status-dot is-${status}`}>{status === 'running' ? <LoaderCircle className="result-spinner" size={ICON_SIZE.sm} aria-hidden="true" /> : <i aria-hidden="true" />}{status === 'error' ? 'Failed' : status === 'success' ? 'Completed' : status === 'running' ? 'Running' : 'Ready'}</span><span>Time <strong>{executionTimeMs == null ? '—' : `${executionTimeMs} ms`}</strong></span></div></footer> : null}
  </section>;
}
