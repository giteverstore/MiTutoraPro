import '../styles/components/content-table.css';

function cellValue(row, column, index) {
  return Array.isArray(row) ? row[index] : row[column?.key];
}

export function ContentTable({ caption, columns = [], rows = [], className = '' }) {
  const heading = caption ?? columns.map((column) => typeof column === 'string' ? column : column.header).join(', ');
  const labelPair = columns.length === 2 && rows.length > 0
    && rows.every((row) => String(cellValue(row, columns[0], 0) ?? '').length <= 32)
    && rows.some((row) => String(cellValue(row, columns[1], 1) ?? '').length > String(cellValue(row, columns[0], 0) ?? '').length);

  return (
    <div className={`content-table-scroll${labelPair ? ' is-label-pair' : ''}${className ? ` ${className}` : ''}`} tabIndex="0" role="region" aria-label={`Table: ${heading}`}>
      <table>
        {caption ? <caption>{caption}</caption> : null}
        <thead>
          <tr>{columns.map((column, index) => (
            <th key={typeof column === 'string' ? `${column}-${index}` : column.key} scope="col" style={column.align ? { textAlign: column.align } : undefined}>
              {typeof column === 'string' ? column : column.header}
            </th>
          ))}</tr>
        </thead>
        <tbody>{rows.map((row, rowIndex) => (
          <tr key={rowIndex}>{columns.map((column, columnIndex) => (
            <td key={typeof column === 'string' ? columnIndex : column.key} style={column.align ? { textAlign: column.align } : undefined}>
              {String(cellValue(row, column, columnIndex) ?? '')}
            </td>
          ))}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}
