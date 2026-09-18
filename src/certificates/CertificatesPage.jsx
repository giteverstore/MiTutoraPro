import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useUser } from '../auth/UserContext';
import { CERTIFICATE_STATUS } from './certificateModel';
import { certificateService } from './CertificateService';
import { CertificateCard } from './CertificateCard';
import { CertificateViewer } from './CertificateViewer';
import { publicVerificationUrl } from './publicCertificateVerification';

const sampleCertificate = Object.freeze({
  id: 'sample',
  credentialId: 'SAMPLE',
  courseId: 'python',
  courseTitle: 'Python Foundations',
  issueDate: null,
  sample: true,
  recipientName: 'ycoders',
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
      setCertificates(records);
      const requested = new URLSearchParams(window.location.search).get('credential');
      if (requested) setViewerCertificate(records.find(({ credentialId }) => credentialId === requested) ?? null);
      setStatus('ready');
    }).catch((error) => { if (active) { setNotice(error.message); setStatus('error'); } });
    return () => { active = false; };
  }, [user.id]);

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
    <section className="certificate-setup-card" aria-labelledby="certificate-setup-title">
      <ShieldCheck aria-hidden="true" />
      <div><h1 id="certificate-setup-title">Test My Setup</h1></div>
      <div className="certificate-setup-actions">
        <button className="button button--secondary" type="button" onClick={onTestSetup}>Test My Setup</button>
        <button className="button button--secondary" type="button" onClick={() => setViewerCertificate(sampleCertificate)}>View Example</button>
      </div>
    </section>

    <section className="completed-certificates" aria-labelledby="completed-certificates-title">
      <header className="certificates-section-heading"><div><h2 id="completed-certificates-title">My Certificates</h2></div></header>
      {status === 'loading' ? <p className="certificate-loading">Loading certificates…</p>
        : status === 'error' ? <p role="alert">Certificates could not be loaded.</p>
          : completed.length ? <div className="certificate-list">{completed.map((certificate) => <CertificateCard certificate={certificate} onView={setViewerCertificate} onDownload={downloadCertificate} onShare={shareCertificate} key={certificate.id} />)}</div>
            : <div className="certificate-empty"><h3>No certificates yet</h3></div>}
    </section>

    <CertificateViewer certificate={viewerCertificate} onClose={() => setViewerCertificate(null)} onDownload={downloadCertificate} onShare={shareCertificate} onCopy={(value) => copyText(value)} />
    {notice ? <div className="settings-toast" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div> : null}
  </div>;
}
