import { BadgeCheck, Link2 } from 'lucide-react';

export function CertificateVerification({ certificate }) {
  return (
    <section className="certificate-verification" aria-labelledby="certificate-verification-title">
      <div>
        <span>Credential verification</span>
        <h2 id="certificate-verification-title">Verification</h2>
        <p>Credentials can be checked using the ID or public verification address.</p>
        <dl>
          <div><dt>Credential ID</dt><dd>{certificate.credentialId}</dd></div>
          <div><dt>Verification Status</dt><dd className="is-verified"><BadgeCheck /> Verified</dd></div>
          <div><dt>Verification URL</dt><dd><Link2 /> {certificate.verificationUrl ?? 'Public verification will be available in a future release.'}</dd></div>
        </dl>
      </div>
      <div className="certificate-qr-placeholder" role="img" aria-label="QR code placeholder for certificate verification">
        <div aria-hidden="true">{Array.from({ length: 49 }, (_, index) => <i className={[0, 1, 2, 7, 9, 13, 14, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 40, 42, 46, 47, 48].includes(index) ? 'is-filled' : ''} key={index} />)}</div>
        <span>QR Code</span>
      </div>
    </section>
  );
}
