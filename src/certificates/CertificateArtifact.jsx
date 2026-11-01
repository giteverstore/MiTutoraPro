import certificateTemplateUrl from '../../Logo/certificate.svg';
import { formatCertificateDate } from './certificateModel';

function verificationLabel(certificate, sample) {
  if (sample) return 'Not issued';
  return certificate.verificationStatus === 'verified' ? 'Verified' : 'Verification pending';
}

export function CertificateArtifact({ certificate }) {
  const sample = certificate.sample === true;
  const recipientName = sample ? 'SAMPLE' : certificate.recipientName || 'Ycoders Learner';
  const issueDate = sample ? 'Not issued' : formatCertificateDate(certificate.issueDate, { month: 'long' });
  const status = verificationLabel(certificate, sample);

  return (
    <div
      className={`certificate-artifact${sample ? ' is-sample' : ''}`}
      role="img"
      aria-label={`${sample ? 'Sample certificate' : 'Certificate'} for ${recipientName}, ${certificate.courseTitle}`}
      data-testid="certificate-artifact"
    >
      <img src={certificateTemplateUrl} alt="" aria-hidden="true" />
      <strong className="certificate-artifact-field certificate-artifact-name" title={recipientName}>
        {recipientName}
      </strong>
      <strong className="certificate-artifact-field certificate-artifact-course" title={certificate.courseTitle}>
        {sample ? 'Sample Certificate' : certificate.courseTitle}
      </strong>
      <span className="certificate-artifact-field certificate-artifact-date">
        {sample ? 'Not issued' : `in ${issueDate}`}
      </span>
      <div className="certificate-artifact-field certificate-artifact-verification">
        <span>Verification</span>
        <strong>{status}</strong>
      </div>
      <div className="certificate-artifact-field certificate-artifact-credential">
        <span>Credential ID:</span>
        <strong>{sample ? 'Not issued' : certificate.credentialId}</strong>
      </div>
      {sample || certificate.verificationStatus !== 'verified' ? (
        <div className="certificate-artifact-unverified-seal" aria-hidden="true">
          <strong>{sample ? 'SAMPLE' : 'PENDING'}</strong>
        </div>
      ) : null}
    </div>
  );
}
