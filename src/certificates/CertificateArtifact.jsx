import certificateTemplateUrl from '../../Logo/certificate.svg';

let certificateArtifactPreloadPromise = null;

export function preloadCertificateArtifact() {
  if (certificateArtifactPreloadPromise) return certificateArtifactPreloadPromise;
  if (typeof Image === 'undefined') return Promise.resolve(certificateTemplateUrl);

  certificateArtifactPreloadPromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(certificateTemplateUrl);
    image.onerror = () => reject(new Error('Certificate artifact could not be preloaded.'));
    image.src = certificateTemplateUrl;
  });
  certificateArtifactPreloadPromise.catch(() => {
    certificateArtifactPreloadPromise = null;
  });
  return certificateArtifactPreloadPromise;
}

export function CertificateArtifact() {
  return (
    <div className="certificate-artifact" data-testid="certificate-artifact">
      <img src={certificateTemplateUrl} alt="Y Coders certificate" />
    </div>
  );
}
