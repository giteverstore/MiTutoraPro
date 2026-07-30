import { CalendarDays, Download, Eye, Share2 } from 'lucide-react';

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function CertificateCard({ certificate, onView, onDownload, onShare }) {
  return (
    <article className="certificate-card">
      <div className="certificate-card-mark" aria-hidden="true"><span>M</span></div>
      <div className="certificate-card-copy">
        <span>Certificate of Completion</span>
        <h3>{certificate.courseTitle}</h3>
        <p>{certificate.description}</p>
        <div className="certificate-card-meta">
          <span><CalendarDays /> {formatDate(certificate.completionDate)}</span>
          <span>Credential <code>{certificate.credentialId}</code></span>
        </div>
      </div>
      <div className="certificate-card-actions">
        <button className="button button--primary" type="button" onClick={() => onView(certificate)}><Eye /> View</button>
        <button className="button button--secondary" type="button" onClick={() => onDownload(certificate)} aria-label={`Download ${certificate.courseTitle} certificate`}><Download /></button>
        <button className="button button--secondary" type="button" onClick={() => onShare(certificate)} aria-label={`Share ${certificate.courseTitle} certificate`}><Share2 /></button>
      </div>
    </article>
  );
}
