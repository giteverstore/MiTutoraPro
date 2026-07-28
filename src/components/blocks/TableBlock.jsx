export function TableBlock({ caption, columns, rows }) {
  return (
    <div className="card card--surface content-section table-card">
      <div className="table-scroll">
        <table>
          {caption ? <caption>{caption}</caption> : null}
          <thead>
            <tr>
              {columns.map((column) => (
                <th style={{ textAlign: column.align }} key={column.key}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td style={{ textAlign: column.align }} key={column.key}>
                    {String(row[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
