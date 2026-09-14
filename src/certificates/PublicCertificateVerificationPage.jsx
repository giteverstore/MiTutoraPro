import { useEffect, useState } from 'react';
import { BadgeCheck, ShieldX } from 'lucide-react';
import { formatCertificateDate } from './certificateModel';
import { verifyPublicCertificate } from './publicCertificateVerification';

export function PublicCertificateVerificationPage({ credentialId, verifier = verifyPublicCertificate }) {
  const [state, setState] = useState({ status: 'loading', certificate: null });
  useEffect(() => {
    let active = true;
    verifier(credentialId).then((certificate) => {
      if (active) setState({ status: certificate.status, certificate });
    }).catch(() => { if (active) setState({ status: 'error', certificate: null }); });
    return () => { active = false; };
  }, [credentialId, verifier]);

  if (state.status === 'loading') return <main className="public-certificate-page" role="status"><p>Verifying certificate…</p></main>;
  if (state.status === 'NOT_FOUND') return <main className="public-certificate-page"><ShieldX aria-hidden="true" /><h1>Certificate not found</h1><p>This credential could not be verified.</p></main>;
  if (state.status === 'REVOKED') return <main className="public-certificate-page"><ShieldX aria-hidden="true" /><h1>Certificate is no longer valid</h1><p>This credential is not currently active.</p></main>;
  if (state.status === 'error') return <main className="public-certificate-page" role="alert"><ShieldX aria-hidden="true" /><h1>Verification unavailable</h1><p>Certificate verification could not be completed.</p></main>;
  const certificate = state.certificate;
  return <main className="public-certificate-page">
    <img src="/ycoders-mark.svg" alt="ycoders" />
    <BadgeCheck aria-hidden="true" />
    <span>Verified Certificate</span>
    <h1>{certificate.courseTitle}</h1>
    <dl>
      <div><dt>Issued to</dt><dd>{certificate.recipientName}</dd></div>
      <div><dt>Issued</dt><dd>{formatCertificateDate(certificate.issuedAt)}</dd></div>
      <div><dt>Credential ID</dt><dd>{certificate.credentialId}</dd></div>
      <div><dt>Status</dt><dd>Verified</dd></div>
    </dl>
  </main>;
}
