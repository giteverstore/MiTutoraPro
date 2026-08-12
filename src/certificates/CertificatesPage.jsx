import { useEffect, useMemo, useState } from 'react';
import { Award } from 'lucide-react';
import { useUser } from '../auth/UserContext';
import { CERTIFICATE_STATUS } from './certificateModel';
import { certificateService } from './CertificateService';
import { certificationService } from '../certification/services/CertificationService';
import { CertificateCard } from './CertificateCard';
import { CertificateOverview } from './CertificateOverview';
import { CertificateVerification } from './CertificateVerification';
import { CertificateViewer } from './CertificateViewer';
import { InProgressCertificateCard } from './InProgressCertificateCard';

export function CertificatesPage({ onContinueCourse, onStartExam, onTestSetup }) {
  const { user } = useUser();
  const [certificates, setCertificates] = useState([]);
  const [status, setStatus] = useState('loading');
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [viewerCertificate, setViewerCertificate] = useState(null);
  const [notice, setNotice] = useState('');
  const [certification, setCertification] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      certificateService.getCertificates(user.id),
      certificationService.getStatus('python'),
    ]).then(([records, certificationStatus]) => {
      if (!active) return;
      setCertificates(records);
      setSelectedCertificate(records.find(({ status: recordStatus }) =>
        recordStatus === CERTIFICATE_STATUS.earned) ?? null);
      setStatus('ready');
      setCertification(certificationStatus);
    }).catch((loadError) => {
      if (!active) return;
      setNotice(loadError.message);
      setStatus('error');
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
  const certificateOverview = useMemo(() => ({
    certificatesEarned: completed.length,
    coursesInProgress: certification?.completionPercentage > 0 && !certification?.certificateId ? 1 : 0,
    hoursCertified: completed.reduce((total, item) => total + item.certifiedHours, 0),
    completionRate: certification?.latestDecision === 'CERTIFIED' ? 100 : 0,
  }), [certification, completed]);

  const certificationCopy = useMemo(() => {
    if (!certification) return null;
    if (certification.certificateId || certification.latestDecision === 'CERTIFIED') return { title: 'Certified', message: 'Your authoritative credential is available below.', action: null };
    if (['SUBMITTED', 'EVALUATING'].includes(certification.activeAttemptState)) return { title: 'Evaluation in progress', message: 'Your submission is being evaluated by the trusted certification service.', action: null };
    if (certification.activeAttemptId) return { title: 'Attempt in progress', message: 'Resume your protected certification attempt.', action: 'Resume exam' };
    const decisionCopy = {
      NOT_CERTIFIED: ['Not certified', 'You may begin another attempt when permitted.'],
      REVIEW_REQUIRED: ['Review required', 'Your attempt is awaiting an integrity review.'],
      INCOMPLETE: ['Incomplete attempt', 'Your previous attempt did not reach final evaluation.'],
    }[certification.latestDecision];
    if (decisionCopy) return { title: decisionCopy[0], message: decisionCopy[1], action: certification.latestDecision === 'NOT_CERTIFIED' && certification.completionPercentage === 100 ? 'Start another attempt' : null };
    if (certification.eligibilityStatus === 'ELIGIBLE') return { title: 'Certification Eligible', message: 'Course completion is verified. You can begin the certification exam.', action: 'Start Certification' };
    return { title: 'Certification locked', message: 'Complete the Python course before starting its certification exam.', action: null };
  }, [certification]);

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
    } else if (certificate.verificationUrl) {
      await copyText(certificate.verificationUrl, 'Verification link');
    } else {
      await copyText(certificate.credentialId, 'Credential ID');
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
      <header className="certificates-heading certificates-heading--with-action">
        <h1>Credentials for the skills you’ve earned.</h1>
        <p>View, verify, and share your completed MiTutora learning achievements.</p>
        <div className="certificates-heading-actions"><button className="button button--secondary" type="button" onClick={onTestSetup}>Test My Setup</button></div>
      </header>

      <CertificateOverview overview={certificateOverview} />

      {certificationCopy ? <section className="in-progress-certificates" aria-labelledby="certification-state-title"><header className="certificates-section-heading"><div><span>Python certification</span><h2 id="certification-state-title">{certificationCopy.title}</h2><p>{certificationCopy.message}</p></div>{certificationCopy.action ? <button className="button button--primary" type="button" onClick={onStartExam}>{certificationCopy.action}</button> : null}</header></section> : null}

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
