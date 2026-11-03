import { BadgeCheck, Copy, Download, Link2, Share2, X } from 'lucide-react';
import { formatCertificateDate } from './certificateModel';
import { Dialog } from '../components/Dialog';
import { CertificateArtifact } from './CertificateArtifact';

export function CertificateViewer({
  certificate,
  onClose,
  onDownload,
  onShare,
  onCopy,
}) {
  if (!certificate) return null;
  const sample = certificate.sample === true;

  return (
    <Dialog open title={certificate.courseTitle} titleHidden onClose={onClose} className="certificate-viewer" backdropClassName="certificate-viewer-backdrop">
        <header className={sample ? 'is-sample' : undefined}>
          <div>{sample ? null : <span>Certificate</span>}<h2 id="certificate-viewer-title">{certificate.courseTitle}</h2>{sample ? null : <p>Certificate preview and credential details</p>}</div>
          <button type="button" onClick={onClose} aria-label="Close certificate viewer" data-autofocus><X /></button>
        </header>
        <div className="certificate-viewer-body">
          <div className="certificate-preview" role="region" aria-label="Certificate preview">
            <CertificateArtifact certificate={certificate} />
          </div>
          <aside className="certificate-viewer-details" aria-label="Credential details">
            <h3>Credential details</h3>
            <dl>
              <div><dt>Learner</dt><dd>{sample ? 'SAMPLE' : certificate.recipientName || 'Ycoders Learner'}</dd></div>
              <div><dt>Course</dt><dd>{certificate.courseTitle}</dd></div>
              <div><dt>Credential ID</dt><dd>{certificate.credentialId}</dd></div>
              <div><dt>Issue Date</dt><dd>{sample ? 'Not issued' : formatCertificateDate(certificate.issueDate, { month: 'long' })}</dd></div>
              <div><dt>Verification Status</dt><dd className={!sample && certificate.verificationStatus === 'verified' ? 'is-verified' : ''}>{sample ? 'Sample Certificate' : certificate.verificationStatus === 'verified' ? <><BadgeCheck /> Verified</> : 'Verification pending'}</dd></div>
            </dl>
            {!sample ? <div className="certificate-viewer-actions">
              <button className="button button--primary" type="button" onClick={() => onDownload(certificate)}><Download /> Download Certificate</button>
              <button className="button button--secondary" type="button" onClick={() => onShare(certificate)}><Share2 /> Share</button>
              <button className="button button--secondary" type="button" onClick={() => onCopy(certificate.credentialId, 'Credential ID')}><Copy /> Copy Credential ID</button>
              {certificate.verificationUrl ? <a className="button button--secondary" href={certificate.verificationUrl} target="_blank" rel="noreferrer"><Link2 /> Verify Certificate</a> : null}
            </div> : null}
          </aside>
        </div>
    </Dialog>
  );
}
