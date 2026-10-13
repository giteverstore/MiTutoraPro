import { ContentTable } from '../ContentTable';

export function TableBlock({ caption, columns, rows }) {
  return <ContentTable caption={caption} columns={columns} rows={rows} className="content-section table-card" />;
}
