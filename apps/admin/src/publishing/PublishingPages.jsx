import { useCallback, useEffect, useMemo, useState } from 'react';
import { ADMIN_PERMISSIONS, hasAdminPermission } from '../../../../shared/admin/adminAuthorization.js';
import { adminContentRequest, editorPath, formatDate, loadAllPages } from './publishingApi.js';
import './publishing.css';

const labels = { PROJECT: 'Project', COURSE: 'Course', PRACTICE: 'Practice', CHALLENGE: 'Challenge' };
const pageSize = 20;
const titleOf = (item) => item?.title || item?.metadataSnapshot?.title || item?.contentId || 'Untitled';
const typeOptions = [['', 'All types'], ['PROJECT', 'Projects'], ['COURSE', 'Courses'], ['PRACTICE', 'Practice'], ['CHALLENGE', 'Challenges']];

function useResource(resource) {
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const reload = useCallback(async () => {
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    try { setState({ loading: false, items: await loadAllPages(resource), error: '' }); }
    catch { setState((previous) => ({ ...previous, loading: false, error: `Couldn’t load ${resource.replace('-', ' ')}. Check your connection and retry.` })); }
  }, [resource]);
  useEffect(() => { void reload(); }, [reload]);
  return { ...state, reload };
}

function PageFrame({ eyebrow, title, description, children }) {
  return <div className="admin-page admin-publishing"><header className="admin-page-heading"><span className="admin-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></header>{children}</div>;
}
function ResourceState({ resource, empty, children }) {
  if (resource.loading) return <p className="publishing-state" role="status">Loading…</p>;
  if (resource.error) return <div className="publishing-state" role="alert"><p>{resource.error}</p><button type="button" onClick={resource.reload}>Retry</button></div>;
  if (!resource.items.length) return <div className="publishing-state">{empty}</div>;
  return children;
}
function Filters({ type, setType, search, setSearch, status, setStatus, statusOptions = [] }) {
  return <div className="publishing-filters"><label>Content type<select value={type} onChange={(event) => setType(event.target.value)}>{typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{statusOptions.length ? <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label> : null}<label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Title or content ID" /></label></div>;
}
function useFiltered(items, type, search, status, statusOf) {
  return useMemo(() => items.filter((item) => (!type || item.contentType === type) && (!status || statusOf(item) === status) && `${titleOf(item)} ${item.contentId}`.toLowerCase().includes(search.toLowerCase().trim())), [items, type, search, status, statusOf]);
}
function useVisible(items) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [items]);
  return { visible: items.slice(0, page * pageSize), remaining: items.length > page * pageSize, more: () => setPage((value) => value + 1) };
}
function LoadMore({ remaining, more }) { return remaining ? <button className="admin-secondary-button publishing-more" type="button" onClick={more}>Load more</button> : null; }
function ActionError({ error, clear }) { return error ? <div className="publishing-action-error" role="alert"><span>{error}</span><button type="button" onClick={clear}>Dismiss</button></div> : null; }
const openEditor = (item, onNavigate) => { const route = editorPath(item.contentType, item.contentId); if (route) onNavigate(route); };

const draftStatus = (item) => item.validationSummary?.valid === false ? 'Validation issues' : item.validationSummary?.valid && item.validationSummary?.validatedAt ? 'Valid' : 'Draft';

export function DraftsPage({ role, onNavigate }) {
  const resource = useResource('draft-summaries');
  const [catalog, setCatalog] = useState([]);
  const [type, setType] = useState(''); const [search, setSearch] = useState(''); const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  useEffect(() => { void loadAllPages('catalog').then(setCatalog).catch(() => setCatalog([])); }, [resource.items]);
  const pointers = useMemo(() => new Map(catalog.map((item) => [item.contentId, item])), [catalog]);
  const enriched = useMemo(() => resource.items.map((item) => ({ ...item, pointer: pointers.get(item.contentId) })), [resource.items, pointers]);
  const filtered = useFiltered(enriched, type, search, status, draftStatus);
  const { visible, remaining, more } = useVisible(filtered);
  const run = async (item, operation) => {
    setBusy(item.contentId); setError('');
    try {
      if (operation === 'validate') await adminContentRequest('validate', { method: 'POST', body: { contentType: item.contentType, contentId: item.contentId, expectedRevision: item.draftRevision } });
      else {
        if (!window.confirm(`Publish ${titleOf(item)}? New learners will receive the new version.`)) return;
        await adminContentRequest('publish', { method: 'POST', body: { contentType: item.contentType, contentId: item.contentId, expectedRevision: item.draftRevision, expectedActiveRevision: item.pointer?.activeRevision ?? 0 } });
      }
      await resource.reload();
    } catch (cause) { setError(cause.message); }
    finally { setBusy(''); }
  };
  return <PageFrame eyebrow="Publishing" title="Drafts" description="Review and open editable content across Projects, Courses, Practice, and Challenges.">
    <ResourceState resource={resource} empty={<><h2>No drafts yet</h2><p>Start by creating your first content item.</p><div className="publishing-actions">{typeOptions.slice(1).map(([value, label]) => <button key={value} type="button" onClick={() => onNavigate(`/content/${{ PROJECT: 'projects', COURSE: 'courses', PRACTICE: 'practice', CHALLENGE: 'challenges' }[value]}/new`)}>New {label === 'Practice' ? 'Practice Question' : label.slice(0, -1)}</button>)}</div></>}>
      <Filters type={type} setType={setType} search={search} setSearch={setSearch} status={status} setStatus={setStatus} statusOptions={[[ '', 'All statuses' ], ['Draft', 'Draft'], ['Valid', 'Valid'], ['Validation issues', 'Validation issues']]} />
      <ActionError error={error} clear={() => setError('')} />
      <div className="publishing-list">{visible.map((item) => {
        const route = editorPath(item.contentType, item.contentId);
        const publicationState = item.pointer?.activeVersion ? item.pointer.sourceDraftRevision == null ? 'Revision status unavailable' : item.pointer.sourceDraftRevision === item.draftRevision ? 'Up to date' : 'Unpublished changes' : null;
        return <article key={item.contentId} className="publishing-row"><div><h2>{titleOf(item)}</h2><p>{labels[item.contentType] ?? item.contentType} · <code>{item.contentId}</code> · Draft revision {item.draftRevision}</p><p>Updated {formatDate(item.updatedAt)} by {item.updatedBy || 'unknown'} · Published v{item.pointer?.activeVersion ?? '—'}</p><span className="publishing-badge">{draftStatus(item)}</span>{publicationState ? <span className="publishing-badge">{publicationState}</span> : null}</div><div className="publishing-actions">{route ? <button type="button" onClick={() => openEditor(item, onNavigate)}>Open</button> : null}<button type="button" disabled={busy === item.contentId || !hasAdminPermission(role, ADMIN_PERMISSIONS.CONTENT_VALIDATE)} onClick={() => run(item, 'validate')}>Validate</button>{hasAdminPermission(role, ADMIN_PERMISSIONS.CONTENT_PUBLISH) && route ? <button type="button" disabled={busy === item.contentId} onClick={() => run(item, 'publish')}>Publish</button> : null}<button type="button" onClick={() => onNavigate(`/publishing/versions?contentId=${encodeURIComponent(item.contentId)}`)}>Versions</button></div></article>;
      })}</div>
      {!filtered.length ? <p className="publishing-state">No drafts match these filters.</p> : null}<LoadMore remaining={remaining} more={more} />
    </ResourceState>
  </PageFrame>;
}

const pointerStatus = (item) => item.publicationStatus === 'ACTIVE' ? 'ACTIVE' : item.publicationStatus === 'ARCHIVED' ? 'ARCHIVED' : 'NO ACTIVE VERSION';

export function PublishedPage({ role, onNavigate }) {
  const resource = useResource('catalog');
  const [type, setType] = useState(''); const [search, setSearch] = useState(''); const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(''); const [error, setError] = useState('');
  const ordered = useMemo(() => [...resource.items].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))), [resource.items]);
  const filtered = useFiltered(ordered, type, search, status, pointerStatus);
  const { visible, remaining, more } = useVisible(filtered);
  const change = async (item) => {
    const archived = item.publicationStatus === 'ARCHIVED';
    const message = archived ? `Reactivate ${titleOf(item)} at v${item.activeVersion}? New learners will receive that version; existing pinned learners keep theirs.` : `Archive ${titleOf(item)}? It will disappear from new learner discovery. Existing pinned learners can continue, and all published versions are retained.`;
    if (!window.confirm(message)) return;
    setBusy(item.contentId); setError('');
    try { await adminContentRequest(archived ? 'rollback' : 'archive', { method: 'POST', body: { contentId: item.contentId, contentType: item.contentType, expectedActiveRevision: item.activeRevision, ...(archived ? { version: item.activeVersion } : {}) } }); await resource.reload(); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(''); }
  };
  return <PageFrame eyebrow="Publishing" title="Published" description="Current publication pointers; immutable versions remain available after archive.">
    <ResourceState resource={resource} empty={<><h2>No published content yet</h2><p>Publish a validated draft to populate this catalog.</p><button type="button" onClick={() => onNavigate('/publishing/drafts')}>View drafts</button></>}>
      <Filters type={type} setType={setType} search={search} setSearch={setSearch} status={status} setStatus={setStatus} statusOptions={[[ '', 'All statuses' ], ['ACTIVE', 'Active'], ['ARCHIVED', 'Archived'], ['NO ACTIVE VERSION', 'No active version']]} />
      <ActionError error={error} clear={() => setError('')} />
      <div className="publishing-list">{visible.map((item) => <article key={item.contentId} className="publishing-row"><div><h2>{titleOf(item)}</h2><p>{labels[item.contentType] ?? item.contentType} · <code>{item.contentId}</code></p><p>ACTIVE v{item.publicationStatus === 'ACTIVE' ? item.activeVersion : '—'} · Latest v{item.latestVersion ?? '—'}</p><p>Published {formatDate(item.publishedAt)} by {item.publishedBy ?? 'unknown'} · Pointer updated {formatDate(item.updatedAt)}</p><span className="publishing-badge">{pointerStatus(item)}</span></div><div className="publishing-actions"><button type="button" onClick={() => onNavigate(`/publishing/versions?contentId=${encodeURIComponent(item.contentId)}`)}>View versions</button>{editorPath(item.contentType, item.contentId) ? <button type="button" onClick={() => openEditor(item, onNavigate)}>Open draft</button> : null}{hasAdminPermission(role, ADMIN_PERMISSIONS.CONTENT_PUBLISH) && ['ACTIVE', 'ARCHIVED'].includes(item.publicationStatus) ? <button type="button" disabled={busy === item.contentId} onClick={() => change(item)}>{item.publicationStatus === 'ARCHIVED' ? 'Reactivate' : 'Archive'}</button> : null}</div></article>)}</div>
      {!filtered.length ? <p className="publishing-state">No published items match these filters.</p> : null}<LoadMore remaining={remaining} more={more} />
    </ResourceState>
  </PageFrame>;
}

export function VersionsPage({ role, onNavigate, selectedContentId = '' }) {
  const resource = useResource('catalog');
  const [selectedId, setSelectedId] = useState(selectedContentId); const [type, setType] = useState(''); const [status, setStatus] = useState('');
  const [history, setHistory] = useState({ loading: false, versions: [], active: null, error: '' });
  const [detail, setDetail] = useState(null); const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState('');
  const items = useMemo(() => resource.items.filter((item) => !type || item.contentType === type), [resource.items, type]);
  useEffect(() => { if (selectedContentId) setSelectedId(selectedContentId); }, [selectedContentId]);
  useEffect(() => { if (items.length && !items.some((item) => item.contentId === selectedId)) setSelectedId(items[0].contentId); }, [selectedId, items]);
  const refresh = useCallback(async () => {
    if (!selectedId) return;
    setHistory((previous) => ({ ...previous, loading: true, error: '' }));
    try { setHistory({ loading: false, ...await adminContentRequest(`history/${encodeURIComponent(selectedId)}`), error: '' }); }
    catch { setHistory((previous) => ({ ...previous, loading: false, error: 'Couldn’t load version history. Retry.' })); }
  }, [selectedId]);
  useEffect(() => { void refresh(); setDetail(null); }, [refresh]);
  const selected = resource.items.find((item) => item.contentId === selectedId);
  const versions = history.versions.filter((item) => !status || (status === 'ACTIVE' ? history.active?.publicationStatus === 'ACTIVE' && item.version === history.active?.activeVersion : item.status === status && item.version !== history.active?.activeVersion));
  const activate = async (version) => {
    if (!window.confirm(`Make v${version.version} active instead of v${history.active?.activeVersion ?? '—'}? New learners receive v${version.version}; existing pinned learners stay on their versions. No versions are deleted.`)) return;
    setBusy(true); setActionError('');
    try { await adminContentRequest('rollback', { method: 'POST', body: { contentId: selectedId, contentType: selected.contentType, version: version.version, expectedActiveRevision: history.active.activeRevision } }); await refresh(); await resource.reload(); }
    catch (cause) { setActionError(cause.message); }
    finally { setBusy(false); }
  };
  return <PageFrame eyebrow="Publishing" title="Version History" description="Inspect immutable versions and choose which READY version new learners receive."><ResourceState resource={resource} empty={<><h2>No version history yet</h2><p>Publish a draft to create an immutable version.</p></>}><div className="publishing-filters"><label>Content type<select value={type} onChange={(event) => { setType(event.target.value); setSelectedId(''); }}>{typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Content item<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{items.map((item) => <option key={item.contentId} value={item.contentId}>{titleOf(item)} ({item.contentId})</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{[['', 'All versions'], ['ACTIVE', 'Active'], ['READY', 'Ready / inactive'], ['CREATING', 'Creating'], ['FAILED', 'Failed']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>{history.loading ? <p role="status">Loading versions…</p> : history.error ? <div role="alert">{history.error} <button type="button" onClick={refresh}>Retry</button></div> : <><ActionError error={actionError} clear={() => setActionError('')} /><div className="publishing-list">{versions.map((version) => { const active = history.active?.publicationStatus === 'ACTIVE' && history.active.activeVersion === version.version; return <article className="publishing-row" key={version.version}><div><h2>v{version.version} · {titleOf(selected)}</h2><p>{labels[version.contentType] ?? version.contentType} · Published {formatDate(version.publishedAt ?? version.createdAt)} by {version.publishedBy ?? version.createdBy ?? 'unknown'}</p><p>Draft revision {version.sourceDraftRevision} · Schema {version.schemaVersion ?? '—'} · {version.artifactSize == null ? '—' : `${version.artifactSize} bytes`} · <code>{version.artifactHash?.slice(0, 12) ?? '—'}</code></p><span className="publishing-badge">{active ? 'ACTIVE' : version.status}</span></div><div className="publishing-actions"><button type="button" onClick={() => setDetail(version)}>Details</button>{hasAdminPermission(role, ADMIN_PERMISSIONS.CONTENT_PUBLISH) && version.status === 'READY' && !active && history.active ? <button type="button" disabled={busy} onClick={() => activate(version)}>Make active</button> : null}</div></article>; })}</div>{!versions.length ? <p className="publishing-state">No versions match this filter.</p> : null}</>}{detail ? <div className="publishing-detail" role="dialog" aria-modal="true" aria-label={`Version ${detail.version} details`}><section><h2>Version v{detail.version}</h2><dl>{[['Content ID', detail.contentId], ['Type', detail.contentType], ['Status', detail.status], ['Schema', detail.schemaVersion], ['Artifact path', detail.artifactPath], ['Size', detail.artifactSize], ['SHA-256', detail.artifactHash], ['Published by', detail.publishedBy], ['Published at', detail.publishedAt], ['Source draft revision', detail.sourceDraftRevision], ['Locale', detail.locale]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl><h3>Metadata snapshot</h3><pre>{JSON.stringify(detail.metadataSnapshot ?? {}, null, 2)}</pre><div className="publishing-actions"><button type="button" onClick={() => openEditor(selected, onNavigate)}>Open draft</button><button type="button" onClick={() => setDetail(null)}>Close</button></div></section></div> : null}</ResourceState></PageFrame>;
}
