import { useEffect, useState } from 'react';
import { ADMIN_PERMISSIONS, hasAdminPermission } from '../../../../../shared/admin/adminAuthorization.js';

export function ProjectPublicationPanel({ draft, dirty, role, repository, onValidation, onReload }) {
  const [state, setState] = useState({ versions: [], active: null, busy: false, error: '' });
  const canPublish = hasAdminPermission(role, ADMIN_PERMISSIONS.CONTENT_PUBLISH);
  const contentId = draft.contentId;
  const revision = draft.draftRevision ?? 0;
  const refresh = async () => {
    const history = await repository.history(contentId);
    setState((current) => ({ ...current, ...history, error: '' }));
  };
  useEffect(() => { if (contentId) void refresh().catch(() => undefined); }, [contentId, revision]);
  const perform = async (operation) => {
    setState((current) => ({ ...current, busy: true, error: '' }));
    try { await operation(); await refresh(); }
    catch (error) { setState((current) => ({ ...current, error: error.message })); }
    finally { setState((current) => ({ ...current, busy: false })); }
  };
  const publish = () => perform(async () => {
    const validation = await repository.validate(contentId, revision);
    onValidation(validation);
    if (validation.valid) await repository.publish(contentId, revision, state.active?.activeRevision ?? null);
  });
  return <section className="project-publication" aria-labelledby="project-publication-title">
    <div><h2 id="project-publication-title">Publication</h2><p>Draft revision {revision} · Latest v{state.versions[0]?.version ?? '—'} · ACTIVE v{state.active?.activeVersion ?? '—'}</p></div>
    <div className="project-publication-actions"><button type="button" disabled={dirty || state.busy || revision < 1} onClick={() => perform(async () => onValidation(await repository.validate(contentId, revision)))}>Validate</button><button id="content-studio-publish-button" type="button" disabled={!canPublish || dirty || state.busy || revision < 1} title={!canPublish ? 'Publishing requires Content Admin or Super Admin.' : undefined} onClick={publish}>{state.busy ? 'Working…' : 'Publish'}</button>{canPublish && state.active?.publicationStatus === 'ACTIVE' ? <button type="button" disabled={state.busy} onClick={() => perform(() => repository.archive(contentId, state.active.activeRevision))}>Archive</button> : null}</div>
    {dirty ? <p className="project-publication-notice">Unpublished changes</p> : null}
    {state.error ? <div role="alert"><p>{state.error}</p>{state.error.includes('updated elsewhere') ? <button type="button" onClick={onReload}>Reload latest version</button> : null}</div> : null}
    {state.versions.length ? <table><thead><tr><th>Version</th><th>Status</th><th>Published</th><th>Publisher</th><th>Schema</th><th>Hash</th><th>Draft</th><th>Action</th></tr></thead><tbody>{state.versions.map((version) => <tr key={version.version}><td>v{version.version}{state.active?.activeVersion === version.version ? ' · ACTIVE' : ''}</td><td>{version.status}</td><td>{version.publishedAt ?? version.createdAt}</td><td>{version.publishedBy ?? version.createdBy}</td><td>{version.schemaVersion ?? '—'}</td><td><code>{version.artifactHash?.slice(0, 12) ?? '—'}</code></td><td>{version.sourceDraftRevision}</td><td>{canPublish && version.status === 'READY' && state.active?.activeVersion !== version.version ? <button type="button" disabled={state.busy} onClick={() => perform(() => repository.rollback(contentId, version.version, state.active.activeRevision))}>Activate</button> : '—'}</td></tr>)}</tbody></table> : <p>No published versions yet.</p>}
  </section>;
}
