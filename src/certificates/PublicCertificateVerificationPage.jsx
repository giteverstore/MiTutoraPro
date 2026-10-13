import { useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { formatCertificateDate } from './certificateModel';
import { verifyPublicCertificate } from './publicCertificateVerification';
import { ErrorState } from '../errors/ErrorState';

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
  if (state.status === 'NOT_FOUND') return <main className="public-certificate-page"><ErrorState title="Certificate not found" description="This credential could not be verified." kind="not-found" /></main>;
  if (state.status === 'REVOKED') return <main className="public-certificate-page"><ErrorState title="Certificate is no longer valid" description="This credential is not currently active." kind="unavailable" /></main>;
  if (state.status === 'error') return <main className="public-certificate-page"><ErrorState title="Verification unavailable" description="Certificate verification could not be completed." kind="failure" alert /></main>;
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
