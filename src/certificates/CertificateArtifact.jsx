import certificateTemplateUrl from '../../Logo/certificate.svg';
import { BadgeCheck } from 'lucide-react';
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
      <div className="certificate-artifact-copy">
        {sample ? <strong className="certificate-artifact-sample">SAMPLE</strong> : null}
        <p>This is to certify that</p>
        <h3 title={recipientName}>{recipientName}</h3>
        <p>has successfully completed</p>
        <h4 title={certificate.courseTitle}>{certificate.courseTitle}</h4>
        <p className="certificate-artifact-date">{sample ? 'Sample Certificate' : `Issued ${issueDate}`}</p>
      </div>
      <div className="certificate-artifact-footer">
        <div><span>Credential ID</span><strong>{certificate.credentialId}</strong></div>
        <div className={sample ? '' : certificate.verificationStatus === 'verified' ? 'is-verified' : ''}>
          <span>Verification</span>
          <strong>{certificate.verificationStatus === 'verified' && !sample ? <BadgeCheck aria-hidden="true" /> : null}{status}</strong>
        </div>
      </div>
      {sample || certificate.verificationStatus !== 'verified' ? <div className="certificate-artifact-seal-mask" aria-hidden="true" /> : null}
    </div>
  );
}
