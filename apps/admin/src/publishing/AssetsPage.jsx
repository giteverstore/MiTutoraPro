import { useEffect, useState } from 'react';
import { ADMIN_PERMISSIONS, hasAdminPermission } from '../../../../shared/admin/adminAuthorization.js';
import { adminContentRequest, formatDate, loadAllPages } from './publishingApi.js';
import './publishing.css';

const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxBytes = 2 * 1024 * 1024;

export function AssetPreview({ asset }) {
  const [source, setSource] = useState('');
  const [previewState, setPreviewState] = useState('loading');
  const publicFallback = /^\/assets\/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp|svg)$/.test(asset?.path ?? '') ? `https://ycoders.com${asset.path}` : '';
  useEffect(() => {
    let active = true;
    let url;
    setSource('');
    setPreviewState('loading');
    const load = async () => {
      try {
        const resolved = asset?.path ? asset : (await adminContentRequest(`assets/${encodeURIComponent(asset.assetId)}`)).asset;
        if (/^\/assets\/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp|svg)$/.test(resolved?.path ?? '')) { if (active) { setSource(`https://ycoders.com${resolved.path}`); setPreviewState('ready'); } return; }
        if (!resolved?.path?.startsWith('admin-content-assets/')) throw new Error('Asset preview unavailable.');
        const blob = await adminContentRequest(`assets/${encodeURIComponent(asset.assetId)}/file`, { binary: true });
        url = URL.createObjectURL(blob);
        if (active) { setSource(url); setPreviewState('ready'); } else URL.revokeObjectURL(url);
      } catch { if (active) { setSource(''); setPreviewState('error'); } }
    };
    void load();
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [asset?.assetId, asset?.path]);
  return source ? <img src={source} alt="" loading="lazy" onError={() => { if (publicFallback && source !== publicFallback) setSource(publicFallback); else { setSource(''); setPreviewState('error'); } }} /> : <span className="publishing-asset-fallback" role={previewState === 'error' ? 'alert' : 'status'}>{previewState === 'loading' ? 'Loading preview...' : 'Preview unavailable'}</span>;
}

export function AssetsPage({ role }) {
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = async () => {
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    try { setState({ loading: false, items: await loadAllPages('assets'), error: '' }); }
    catch { setState((previous) => ({ ...previous, loading: false, error: 'Couldn’t load assets. Check your connection and retry.' })); }
  };
  useEffect(() => { void load(); }, []);
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!allowed.has(file.type) || file.size > maxBytes) { setMessage('Choose a PNG, JPEG, or WebP image no larger than 2 MiB.'); return; }
    setBusy(true); setMessage('');
    try {
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
      await adminContentRequest('assets', { method: 'POST', body: { name: file.name, mediaType: file.type, data } });
      setMessage(`${file.name} uploaded.`);
      await load();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const visible = state.items.filter((item) => `${item.name ?? ''} ${item.assetId}`.toLowerCase().includes(search.toLowerCase().trim()));
  return <div className="admin-page admin-publishing"><header className="admin-page-heading"><h1>Assets</h1><p>Registered images for Course, Project, and Practice content. Published references are retained; deletion is not available.</p></header><div className="publishing-filters"><label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or asset ID" /></label>{hasAdminPermission(role, ADMIN_PERMISSIONS.CONTENT_EDIT) ? <label className="publishing-upload">Upload image<input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" disabled={busy} onChange={upload} /></label> : null}</div>{message ? <p role="status">{message}</p> : null}{state.loading ? <p className="publishing-state" role="status">Loading assets…</p> : state.error ? <div className="publishing-state" role="alert"><p>{state.error}</p><button type="button" onClick={load}>Retry</button></div> : !state.items.length ? <p className="publishing-state">No assets are registered yet.</p> : !visible.length ? <p className="publishing-state">No assets match your search.</p> : <div className="publishing-assets">{visible.map((asset) => <article key={asset.assetId}><div className="publishing-asset-preview"><AssetPreview asset={asset} /></div><h2>{asset.name ?? asset.assetId}</h2><p><code>{asset.assetId}</code></p><p>{asset.mediaType ?? 'Image'} · {asset.size == null ? 'Size unavailable' : `${Math.round(asset.size / 1024)} KiB`} · {asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'Dimensions unavailable'}</p><p>{asset.status ?? 'ACTIVE'} · {formatDate(asset.createdAt)}</p></article>)}</div>}</div>;
}
