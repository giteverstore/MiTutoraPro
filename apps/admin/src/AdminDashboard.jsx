import { useEffect, useState } from 'react';
import { ADMIN_ROUTES } from './adminRoutes.js';
import { CloudDraftRepository } from './content-studio/persistence/CloudDraftRepository.js';

const contentRoutes = ADMIN_ROUTES.filter(({ section }) => section === 'Content');

export function AdminDashboard({ onNavigate }) {
  const [counts, setCounts] = useState(null);
  useEffect(() => { new CloudDraftRepository().list().then((drafts) => setCounts(Object.fromEntries(['PROJECT','COURSE','PRACTICE'].map((type) => [type, { draft: drafts.filter((item) => item.contentType === type && item.lifecycleState !== 'PUBLISHED').length, published: drafts.filter((item) => item.contentType === type && item.lifecycleState === 'PUBLISHED').length }])))).catch(() => undefined); }, []);
  return <div className="admin-page"><header className="admin-page-heading"><span className="admin-eyebrow">Canonical content operations</span><h1>Content Studio</h1><p>Author, validate, preview, and publish content through one secure lifecycle.</p></header>
    {counts && <section aria-labelledby="content-status"><h2 id="content-status">Content status</h2><div className="admin-module-grid">{Object.entries(counts).map(([type, value]) => <article key={type}><div><h3>{type === 'PROJECT' ? 'Projects' : type === 'COURSE' ? 'Courses' : 'Practice'}</h3><p>{value.draft} drafts · {value.published} published drafts</p></div></article>)}</div></section>}
    <section className="admin-module-grid" aria-labelledby="admin-content-modules"><h2 id="admin-content-modules">Content modules</h2>{contentRoutes.map((item) => { const Icon = item.icon; return <article key={item.path}><Icon aria-hidden="true" /><div><h3>{item.label}</h3><p>{item.description}</p><span>{item.phase}</span></div><button type="button" onClick={() => onNavigate(item.path)}>View status</button></article>; })}</section>
    <aside className="admin-foundation-note"><strong>Administrative content only.</strong><p>Counts come from authorized cloud drafts and do not include learner or revenue analytics.</p></aside>
  </div>;
}

export function AdminPlaceholder({ route }) {
  const Icon = route.icon;
  return <div className="admin-page"><header className="admin-page-heading"><span className="admin-eyebrow">{route.phase}</span><h1>{route.label}</h1><p>{route.description}</p></header><section className="admin-placeholder"><Icon aria-hidden="true" /><h2>Not implemented yet</h2><p>This route establishes the Admin application boundary only. It contains no fake controls or authoring behavior.</p></section></div>;
}

export function AdminNotFound({ onNavigate }) {
  return <div className="admin-page"><section className="admin-placeholder"><span className="admin-not-found-code">404</span><h1>Admin page not found</h1><p>The requested Admin route does not exist.</p><button className="admin-primary-button" type="button" onClick={() => onNavigate('/')}>Return to Dashboard</button></section></div>;
}
