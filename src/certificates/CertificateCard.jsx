import { CalendarDays, Download, Eye, Share2 } from 'lucide-react';
import { formatCertificateDate } from './certificateModel';

export function CertificateCard({ certificate, onView, onDownload, onShare }) {
  return (
    <article className="certificate-card">
      <div className="certificate-card-mark" aria-hidden="true"><span>M</span></div>
      <div className="certificate-card-copy">
        <h3>{certificate.courseTitle}</h3>
        <div className="certificate-card-meta">
          <span><CalendarDays /> Issued {formatCertificateDate(certificate.issueDate)}</span>
          <span>Credential <code>{certificate.credentialId}</code></span>
        </div>
      </div>
      <div className="certificate-card-actions">
        <button className="button button--primary" type="button" onClick={() => onView(certificate)}><Eye /> View</button>
        <button className="button button--secondary" type="button" onClick={() => onDownload(certificate)}><Download /> Download</button>
        <button className="button button--secondary" type="button" onClick={() => onShare(certificate)}><Share2 /> Share</button>
      </div>
    </article>
  );
}
