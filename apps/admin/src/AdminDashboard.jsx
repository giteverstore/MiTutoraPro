import { useCallback } from 'react';
import { useStudioList } from './content-studio/StudioListState.jsx';
import { loadAllPages } from './publishing/publishingApi.js';

const names = { PROJECT: 'Projects', COURSE: 'Courses', PRACTICE: 'Practice', CHALLENGE: 'Challenges' };

export function AdminDashboard() {
  const resource = useStudioList(useCallback(async () => { const [drafts, published] = await Promise.all([loadAllPages('draft-summaries'), loadAllPages('catalog')]); return [...drafts.map((item) => ({ ...item, countKind: 'draft' })), ...published.filter((item) => item.publicationStatus === 'ACTIVE').map((item) => ({ ...item, countKind: 'published' }))]; }, []));
  return <div className="admin-page"><header className="admin-page-heading"><h1>Content Studio</h1><p>Author, validate, preview, and publish content through one secure lifecycle.</p></header>
    <section aria-labelledby="content-status"><h2 id="content-status">Content status</h2>{resource.status === 'loading' ? <p role="status">Loading content status...</p> : resource.status === 'error' ? <div role="alert">Could not load content status. <button type="button" onClick={resource.reload}>Retry</button></div> : <div className="admin-module-grid">{Object.entries(names).map(([type, name]) => { const items = resource.items.filter((item) => item.contentType === type); return <article key={type}><div><h3>{name}</h3><p>{items.filter((item) => item.countKind === 'draft').length} drafts · {items.filter((item) => item.countKind === 'published').length} active published</p></div></article>; })}</div>}</section>
  </div>;
}

export function AdminPlaceholder({ route }) {
  const Icon = route.icon;
  return <div className="admin-page"><header className="admin-page-heading"><h1>{route.label}</h1><p>{route.description}</p></header><section className="admin-placeholder"><Icon aria-hidden="true" /><h2>Not implemented yet</h2><p>This route establishes the Admin application boundary only. It contains no fake controls or authoring behavior.</p></section></div>;
}

export function AdminNotFound({ onNavigate }) {
  return <div className="admin-page"><section className="admin-placeholder"><span className="admin-not-found-code">404</span><h1>Admin page not found</h1><p>The requested Admin route does not exist.</p><button className="admin-primary-button" type="button" onClick={() => onNavigate('/')}>Return to Dashboard</button></section></div>;
}
