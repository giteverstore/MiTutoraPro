import { Image as ImageIcon } from 'lucide-react';
import { ICON_SIZE } from '../../design-system/theme';

export function ImageBlock({ src, alt, caption, title, description, loading = 'lazy' }) {
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
