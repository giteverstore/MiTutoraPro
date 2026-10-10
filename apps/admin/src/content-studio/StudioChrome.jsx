import { useEffect, useRef, useState } from 'react';
import { Braces, PanelLeft, PanelRight } from 'lucide-react';
import { ADMIN_PERMISSIONS, hasAdminPermission } from '../../../../shared/admin/adminAuthorization.js';

export function StudioHeader({ type, title, draft, dirty, saveError, readOnly, role, view, onView, onValidate, onHistory, onPublish, onReload }) {
  const status = saveError ? (/conflict|updated elsewhere/i.test(saveError) ? 'Conflict' : 'Save failed') : dirty ? 'Saving…' : draft.draftRevision > 0 ? 'Saved' : 'Draft';
  const canPublish = Boolean(onPublish && hasAdminPermission(role, ADMIN_PERMISSIONS.CONTENT_PUBLISH));
  return <>
    <header className="content-studio-heading studio-unified-heading">
      <div><h1>{title}</h1><p><span aria-live="polite">{status}</span> · Draft revision {draft.draftRevision ?? 0}{readOnly ? ' · Read only' : ''}</p></div>
      <div className="studio-header-actions">
        <button type="button" aria-label={view === 'preview' ? 'Back to editor' : 'Preview & Test'} onClick={() => onView(view === 'preview' ? 'author' : 'preview')}>{view === 'preview' ? 'Back to editor' : 'Preview'}</button>
        <button type="button" aria-label={`Validate ${type === 'PRACTICE' ? 'Question' : type.charAt(0) + type.slice(1).toLowerCase()}`} onClick={onValidate}>Validate</button>
        {onHistory ? <button type="button" onClick={onHistory}>Version History</button> : null}
        {canPublish ? <button type="button" className="admin-primary-button" disabled={dirty || draft.draftRevision < 1} onClick={onPublish}>Publish</button> : null}
        <details className="studio-more"><summary>More</summary><button type="button" onClick={() => onView(view === 'json' ? 'author' : 'json')}><Braces aria-hidden="true" />{view === 'json' ? 'Back to editor' : 'Generated JSON'}</button></details>
      </div>
    </header>
    {saveError ? <div className="studio-save-error" role="alert"><span>{saveError}</span>{onReload && /updated elsewhere/i.test(saveError) ? <button type="button" onClick={onReload}>Reload latest version</button> : null}</div> : null}
  </>;
}

const STRUCTURE_PREFERENCE = 'ycoders.admin.studio.structure-collapsed.v1';

export function StudioWorkspace({ structure, canvas, inspector, toolbar, structureLabel = 'Structure', className = '' }) {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1180px)').matches);
  const [drawer, setDrawer] = useState(null);
  const [structureCollapsed, setStructureCollapsed] = useState(() => {
    try { return window.localStorage.getItem(STRUCTURE_PREFERENCE) === 'true'; } catch { return false; }
  });
  const toggleRef = useRef(null);
  useEffect(() => {
    try { window.localStorage.setItem(STRUCTURE_PREFERENCE, String(structureCollapsed)); } catch { /* Session-only when storage is unavailable. */ }
  }, [structureCollapsed]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1180px)');
    const update = () => { setCompact(media.matches); setDrawer(null); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape' && drawer) { setDrawer(null); toggleRef.current?.focus(); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [drawer]);
  const open = (event, name) => { toggleRef.current = event.currentTarget; setDrawer(name); };
  return <div className={`studio-workspace-wrap${structureCollapsed && !compact ? ' is-structure-collapsed' : ''} ${className}`}>
    {toolbar}
    <div className="studio-drawer-controls">
      <button type="button" aria-controls="studio-structure" aria-expanded={drawer === 'structure'} onClick={(event) => open(event, 'structure')}><PanelLeft aria-hidden="true" />{structureLabel}</button>
      <button type="button" aria-controls="studio-properties" aria-expanded={drawer === 'properties'} onClick={(event) => open(event, 'properties')}><PanelRight aria-hidden="true" />Properties</button>
    </div>
    {compact && drawer ? <button type="button" className="studio-drawer-scrim" aria-label="Close panel" onClick={() => { setDrawer(null); toggleRef.current?.focus(); }} /> : null}
    <div className="studio-unified-workspace">
      <aside id="studio-structure" className="studio-structure" aria-label={structureLabel} hidden={compact && drawer !== 'structure'}>
        {compact ? <button type="button" className="studio-drawer-close" onClick={() => { setDrawer(null); toggleRef.current?.focus(); }}>Close {structureLabel}</button> : null}
        {!compact ? <button type="button" className="studio-structure-toggle" aria-label={structureCollapsed ? 'Expand structure sidebar' : 'Collapse structure sidebar'} aria-controls="studio-structure-content" aria-expanded={!structureCollapsed} onClick={() => setStructureCollapsed((value) => !value)}><PanelLeft aria-hidden="true" /></button> : null}
        <div id="studio-structure-content" className="studio-structure-content" aria-hidden={structureCollapsed && !compact ? 'true' : undefined} inert={structureCollapsed && !compact ? '' : undefined}>{structure}</div>
      </aside>
      <section className="studio-main-canvas" aria-label="Content canvas">{canvas}</section>
      <aside id="studio-properties" className="studio-properties" aria-label="Properties" hidden={compact && drawer !== 'properties'}>
        {compact ? <button type="button" className="studio-drawer-close" onClick={() => { setDrawer(null); toggleRef.current?.focus(); }}>Close Properties</button> : null}
        {inspector}
      </aside>
    </div>
  </div>;
}
