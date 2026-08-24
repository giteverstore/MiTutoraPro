import { BadgeCheck, Copy, Download, Link2, Share2, X } from 'lucide-react';
import { formatCertificateDate } from './certificateModel';
import { Dialog } from '../components/Dialog';

export function CertificateViewer({
  certificate,
  onClose,
  onDownload,
  onShare,
  onCopy,
}) {
  if (!certificate) return null;

  return (
    <Dialog open title={certificate.courseTitle} titleHidden description="Certificate preview and credential actions" onClose={onClose} className="certificate-viewer" backdropClassName="certificate-viewer-backdrop">
        <header>
          <div><span>Certificate Viewer</span><h2 id="certificate-viewer-title">{certificate.courseTitle}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close certificate viewer" data-autofocus><X /></button>
        </header>
        <div className="certificate-viewer-body">
          <div className="certificate-preview">
            <div className="certificate-preview-brand"><span>M</span><strong>MiTutora</strong></div>
            <span>Certificate of Completion</span>
            <p>This certifies that</p>
            <h3>MiTutora Learner</h3>
            <p>has successfully completed</p>
            <h4>{certificate.courseTitle}</h4>
            <div><span>Issued {formatCertificateDate(certificate.issueDate, { month: 'long' })}</span><span>Credential {certificate.credentialId}</span></div>
          </div>
          <aside className="certificate-viewer-details">
            <dl>
              <div><dt>Credential ID</dt><dd>{certificate.credentialId}</dd></div>
              <div><dt>Issue Date</dt><dd>{formatCertificateDate(certificate.issueDate, { month: 'long' })}</dd></div>
              <div><dt>Verification Status</dt><dd className="is-verified"><BadgeCheck /> Verified</dd></div>
            </dl>
            <div className="certificate-viewer-actions">
              <button className="button button--primary" type="button" onClick={() => onDownload(certificate)}><Download /> Download PDF</button>
              <button className="button button--secondary" type="button" onClick={() => onShare(certificate)}><Share2 /> Share</button>
              <button className="button button--secondary" type="button" onClick={() => onCopy(certificate.credentialId, 'Credential ID')}><Copy /> Copy Credential ID</button>
              {certificate.verificationUrl ? <button className="button button--secondary" type="button" onClick={() => onCopy(certificate.verificationUrl, 'Verification link')}><Link2 /> Copy Verification Link</button> : null}
            </div>
          </aside>
        </div>
    </Dialog>
  );
}
