import { useEffect, useMemo, useState } from 'react';
import { Award } from 'lucide-react';
import { useUser } from '../auth/UserContext';
import { CERTIFICATE_STATUS } from './certificateModel';
import { certificateService } from './CertificateService';
import { CertificateCard } from './CertificateCard';
import { CertificateViewer } from './CertificateViewer';
import { publicVerificationUrl } from './publicCertificateVerification';
import { ErrorState } from '../errors/ErrorState';

const sampleCertificate = Object.freeze({
  id: 'sample',
  credentialId: 'SAMPLE',
  courseId: 'python',
  courseTitle: 'Sample Certificate',
  issueDate: null,
  sample: true,
  recipientName: 'SAMPLE',
  verificationStatus: 'sample',
});

export function CertificatesPage({ onTestSetup }) {
  const { user } = useUser();
  const [certificates, setCertificates] = useState([]);
  const [status, setStatus] = useState('loading');
  const [viewerCertificate, setViewerCertificate] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    certificateService.getCertificates(user.id).then((records) => {
      if (!active) return;
      const displayCertificates = records.map((certificate) => ({
        ...certificate,
        recipientName: certificate.recipientName || user.name || null,
        verificationUrl: certificate.verificationUrl || publicVerificationUrl(certificate.credentialId),
      }));
      setCertificates(displayCertificates);
      const requested = new URLSearchParams(window.location.search).get('credential');
      if (requested) setViewerCertificate(displayCertificates.find(({ credentialId }) => credentialId === requested) ?? null);
      setStatus('ready');
    }).catch(() => { if (active) { setNotice(''); setStatus('error'); } });
    return () => { active = false; };
  }, [user.id, user.name]);

  const completed = useMemo(() => certificates.filter(({ status: recordStatus }) => recordStatus === CERTIFICATE_STATUS.earned), [certificates]);
  const copyText = async (value) => {
    try { await navigator.clipboard.writeText(value); setNotice('Verification link copied.'); }
    catch { setNotice('Copy unavailable.'); }
  };
  const shareCertificate = async (certificate) => {
    const url = publicVerificationUrl(certificate.credentialId);
    const shareData = { title: `${certificate.courseTitle} Certificate`, text: `Verify my ycoders certificate.`, url };
    if (navigator.share) {
      try { await navigator.share(shareData); setNotice('Certificate shared.'); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    await copyText(url);
  };
  const downloadCertificate = (certificate) => {
    const blob = new Blob([certificateService.exportCertificate(certificate)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `${certificate.credentialId}.json`; link.click(); URL.revokeObjectURL(url);
    setNotice('Certificate downloaded.');
  };

  return <div className="certificates-page certificates-page--simple">
    <header className="certificates-page-header">
      <h1>Certificates</h1>
      <div className="certificate-setup-actions" aria-label="Certificate tools">
        <button className="button button--secondary" type="button" onClick={onTestSetup}>Test My Setup</button>
        <button className="button button--secondary" type="button" onClick={() => setViewerCertificate(sampleCertificate)}>View Example</button>
      </div>
    </header>

    <section className="completed-certificates" aria-label="Certificates">
      {status === 'loading' ? <p className="certificate-loading">Loading certificates…</p>
        : status === 'error' ? <ErrorState title="Certificates could not be loaded." description="Please try again later. Your certificates remain unchanged." variant="panel" alert />
          : completed.length ? <div className="certificate-list">{completed.map((certificate) => <CertificateCard certificate={certificate} onView={setViewerCertificate} key={certificate.id} />)}</div>
            : <div className="certificate-empty"><Award aria-hidden="true" /><h3>No certificates yet</h3><p>Complete an eligible certification assessment to earn your first certificate.</p></div>}
    </section>

    <CertificateViewer certificate={viewerCertificate} onClose={() => setViewerCertificate(null)} onDownload={downloadCertificate} onShare={shareCertificate} onCopy={(value) => copyText(value)} />
    {notice ? <div className="settings-toast" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div> : null}
  </div>;
}
