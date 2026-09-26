import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseResultPanel } from '../../src/components/DatabaseResultPanel.jsx';

afterEach(cleanup);

const renderPanel = (props = {}) => render(<DatabaseResultPanel
  database={null}
  error=""
  isRunning={false}
  executionTimeMs={null}
  executionStatus="idle"
  height={260}
  collapsed={false}
  onExpand={vi.fn()}
  onToggleCollapsed={vi.fn()}
  {...props}
/>);

describe('database result panel', () => {
  it('renders headers, typed rows, NULL, counts, and execution time', () => {
    renderPanel({
      database: { resultSets: [{ columns: ['id', 'name'], rows: [[1, 'Avi'], [2, null]], rowCount: 2 }], affectedRows: 0 },
      executionTimeMs: 4,
      executionStatus: 'success',
    });
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'id' })).toBeVisible();
    expect(within(table).getByText('Avi')).toBeVisible();
    expect(within(table).getByText('NULL')).toHaveClass('database-null');
    expect(screen.getByText('2 rows')).toBeVisible();
    expect(screen.getByText('4 ms')).toBeVisible();
  });

  it('renders multiple result sets and non-query feedback', () => {
    const { rerender } = renderPanel({ database: { resultSets: [
      { columns: ['one'], rows: [[1]], rowCount: 1 },
      { columns: ['two'], rows: [[2]], rowCount: 1 },
    ], affectedRows: 0 }, executionStatus: 'success' });
    expect(screen.getByText('Result 1')).toBeVisible();
    expect(screen.getByText('Result 2')).toBeVisible();
    rerender(<DatabaseResultPanel database={{ resultSets: [], affectedRows: 3 }} error="" isRunning={false} executionStatus="success" height={260} collapsed={false} />);
    expect(screen.getByText('3 rows affected.')).toBeVisible();
  });

  it('renders concise SQL errors and explicitly reports display truncation', () => {
    const rows = Array.from({ length: 501 }, (_, index) => [index]);
    const { rerender } = renderPanel({ error: 'SQL execution error: no such column: missing', executionStatus: 'error' });
    expect(screen.getByText('SQL Error')).toBeVisible();
    expect(screen.getByText(/no such column/)).toBeVisible();
    rerender(<DatabaseResultPanel database={{ resultSets: [{ columns: ['id'], rows, rowCount: rows.length }], affectedRows: 0 }} error="" isRunning={false} executionStatus="success" height={260} collapsed={false} />);
    expect(screen.getByText(/Showing first 500 rows/)).toBeVisible();
    expect(screen.getAllByRole('row')).toHaveLength(501);
  }, 10_000);
});
