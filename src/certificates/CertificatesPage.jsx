import { useEffect, useMemo, useState } from 'react';
import { Award } from 'lucide-react';
import { useUser } from '../auth/UserContext';
import { certificateOverview } from './certificateData';
import { CERTIFICATE_STATUS } from './certificateModel';
import { certificateService } from './CertificateService';
import { CertificateCard } from './CertificateCard';
import { CertificateOverview } from './CertificateOverview';
import { CertificateVerification } from './CertificateVerification';
import { CertificateViewer } from './CertificateViewer';
import { InProgressCertificateCard } from './InProgressCertificateCard';

export function CertificatesPage({ onContinueCourse }) {
  const { user } = useUser();
  const [certificates, setCertificates] = useState([]);
  const [status, setStatus] = useState('loading');
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [viewerCertificate, setViewerCertificate] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    certificateService.getCertificates(user.id).then((records) => {
      if (!active) return;
      setCertificates(records);
      setSelectedCertificate(records.find(({ status: recordStatus }) =>
        recordStatus === CERTIFICATE_STATUS.earned) ?? null);
      setStatus('ready');
    });
    return () => { active = false; };
  }, [user.id]);

  const completed = useMemo(
    () => certificates.filter(({ status: recordStatus }) =>
      recordStatus === CERTIFICATE_STATUS.earned),
    [certificates],
  );
  const inProgress = useMemo(
    () => certificates.filter(({ status: recordStatus }) =>
      recordStatus === CERTIFICATE_STATUS.inProgress),
    [certificates],
  );

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      setNotice(`Copy unavailable. ${label}: ${value}`);
    }
  };
  const shareCertificate = async (certificate) => {
    const shareData = {
      title: `${certificate.courseTitle} Certificate`,
      text: `Verify my MiTutora credential ${certificate.credentialId}.`,
      url: certificate.verificationUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setNotice('Certificate shared.');
      } catch (error) {
        if (error.name !== 'AbortError') setNotice('Sharing is unavailable.');
      }
    } else {
      await copyText(certificate.verificationUrl, 'Verification link');
    }
  };
  const downloadPlaceholder = (certificate) => {
    setNotice(`PDF download for ${certificate.courseTitle} is prepared for the certificate API.`);
  };
  const viewCertificate = (certificate) => {
    setSelectedCertificate(certificate);
    setViewerCertificate(certificate);
  };

  return (
    <div className="certificates-page">
      <header className="certificates-heading">
        <h1>Credentials for the skills you’ve earned.</h1>
        <p>View, verify, and share your completed MiTutora learning achievements.</p>
      </header>

      <CertificateOverview overview={certificateOverview} />

      <section className="completed-certificates" aria-labelledby="completed-certificates-title">
        <header className="certificates-section-heading"><div><span>Achievements</span><h2 id="completed-certificates-title">Completed Certificates</h2><p>Verified credentials from completed courses.</p></div><Award aria-hidden="true" /></header>
        <div className="certificate-list">
          {status === 'loading' ? <p className="certificate-loading">Loading certificates…</p> : completed.map((certificate) => (
            <CertificateCard certificate={certificate} onView={viewCertificate} onDownload={downloadPlaceholder} onShare={shareCertificate} key={certificate.id} />
          ))}
        </div>
      </section>

      <section className="in-progress-certificates" aria-labelledby="in-progress-certificates-title">
        <header className="certificates-section-heading"><div><span>Keep learning</span><h2 id="in-progress-certificates-title">In Progress</h2><p>Complete each course to unlock its verified certificate.</p></div></header>
        <div className="certificate-progress-grid">
          {inProgress.map((course) => <InProgressCertificateCard course={course} onContinue={onContinueCourse} key={course.id} />)}
        </div>
      </section>

      {selectedCertificate ? <CertificateVerification certificate={selectedCertificate} /> : null}

      <CertificateViewer
        certificate={viewerCertificate}
        onClose={() => setViewerCertificate(null)}
        onDownload={downloadPlaceholder}
        onShare={shareCertificate}
        onCopy={copyText}
      />
      {notice ? <div className="settings-toast" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div> : null}
    </div>
  );
}
