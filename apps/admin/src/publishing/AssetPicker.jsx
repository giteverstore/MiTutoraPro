import { useEffect, useState } from 'react';
import { AssetPreview } from './AssetsPage.jsx';
import { loadAllPages } from './publishingApi.js';

export function AssetPicker({ onSelect }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    loadAllPages('assets').then((values) => { if (live) { setItems(values); setError(''); } }).catch(() => { if (live) setError('Couldn’t load assets. Close and try again.'); });
    return () => { live = false; };
  }, [open]);
  return <><button type="button" onClick={() => setOpen(true)}>Select asset</button>{open ? <div className="publishing-detail" role="dialog" aria-modal="true" aria-label="Select asset"><section><h2>Select asset</h2><label>Search assets<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>{error ? <p role="alert">{error}</p> : <div className="publishing-assets">{items.filter((asset) => `${asset.name ?? ''} ${asset.assetId}`.toLowerCase().includes(search.toLowerCase())).map((asset) => <article key={asset.assetId}><div className="publishing-asset-preview"><AssetPreview asset={asset} /></div><strong>{asset.name ?? asset.assetId}</strong><p><code>{asset.assetId}</code></p><button type="button" onClick={() => { onSelect(asset.assetId); setOpen(false); }}>Select</button></article>)}</div>}<button type="button" onClick={() => setOpen(false)}>Cancel</button></section></div> : null}</>;
}
