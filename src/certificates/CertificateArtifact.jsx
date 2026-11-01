import certificateTemplateUrl from '../../Logo/certificate.svg';

export function CertificateArtifact() {
  return (
    <div className="certificate-artifact" data-testid="certificate-artifact">
      <img src={certificateTemplateUrl} alt="Y Coders certificate" />
    </div>
  );
}
