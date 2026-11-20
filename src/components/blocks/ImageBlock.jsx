import { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';
import { authService } from '../../auth/AuthService';

export function v2AssetDeliveryUrl(delivery) {
  return `/api/v2-pilot/courses/${encodeURIComponent(delivery.contentId)}/versions/${delivery.publicationVersion}/assets/${encodeURIComponent(delivery.assetId)}`;
}

function V2PilotImage({ delivery, alt, caption, loading }) {
  const [state, setState] = useState({ src: null, error: false });
  useEffect(() => {
    let active = true;
    let objectUrl = null;
    const controller = new AbortController();
    (async () => {
      try {
        const token = await authService.getIdToken();
        if (!token) throw new Error('Authentication required.');
        const response = await fetch(v2AssetDeliveryUrl(delivery), {
          signal: controller.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Image delivery failed.');
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setState({ src: objectUrl, error: false });
      } catch (error) {
        if (active && error.name !== 'AbortError') setState({ src: null, error: true });
      }
    })();
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [delivery.assetId, delivery.contentId, delivery.publicationVersion]);

  if (state.src) return <figure className="card card--muted card--interactive content-section lesson-image"><img src={state.src} alt={alt} loading={loading} />{caption ? <figcaption>{caption}</figcaption> : null}</figure>;
  return <section className="card card--muted content-section visual-placeholder" role={state.error ? 'status' : undefined}><div className="visual-label"><span><ImageIcon size={ICON_SIZE.xl} /></span><strong>{state.error ? 'Image unavailable' : 'Loading image…'}</strong>{caption ? <small>{caption}</small> : null}</div></section>;
}

export function ImageBlock({ src, alt, caption, title, description, loading = 'lazy', delivery }) {
  if (delivery?.kind === 'versioned-v2-asset' && delivery.namespace === 'v2') return <V2PilotImage delivery={delivery} alt={alt} caption={caption} loading={loading} />;
  if (src) {
    return (
      <figure className="card card--muted card--interactive content-section lesson-image">
        <img src={src} alt={alt} loading={loading} />
        {caption ? <figcaption>{caption}</figcaption> : null}
      </figure>
    );
  }

  return (
    <section className="card card--muted card--interactive content-section visual-placeholder">
      <div className="visual-grid" />
      <div className="visual-label">
        <span><ImageIcon size={ICON_SIZE.xl} /></span>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
    </section>
  );
}
