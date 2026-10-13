import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/theme.css';
import '../../src/design-system/tokens.css';
import '../../src/design-system/primitives.css';
import '../../src/styles/index.css';
import '../../src/styles/pages/certificates.css';
import '../../src/styles/standalone-compiler.css';
import { ErrorState } from '../../src/errors/ErrorState.jsx';
import { CertificateViewer } from '../../src/certificates/CertificateViewer.jsx';
import { StandaloneCompilerLanding } from '../../src/standalone-compiler/StandaloneCompilerLanding.jsx';

const query = new URLSearchParams(location.search);
const theme = query.get('theme') === 'dark' ? 'dark' : 'light';
const surface = query.get('surface') ?? 'course';
document.documentElement.dataset.theme = theme;
localStorage.setItem('ycoders.standaloneCompiler.preferences', JSON.stringify({ appearance: theme }));

const cases = {
  course: { title: 'The course workspace could not be displayed.', description: 'Your saved progress is unaffected. Return to the course list or try loading the workspace again.', referenceId: 'error-visual-reference', alert: true, primaryAction: { label: 'Try again', onClick: () => {} }, secondaryAction: { label: 'Go back', onClick: () => {} } },
  project: { title: 'Project not found.', description: 'This project does not exist or is no longer available.', kind: 'not-found', primaryAction: { label: 'Back to Projects', onClick: () => {} } },
  practice: { title: 'This question couldn’t be loaded.', description: 'The catalog remains available. Retry this question or return to Practice.', alert: true, primaryAction: { label: 'Retry', onClick: () => {} }, secondaryAction: { label: 'Back to Practice', onClick: () => {} } },
  challenge: { title: 'This daily challenge is unavailable.', description: 'Return to Challenges and choose another available challenge.', kind: 'unavailable', primaryAction: { label: 'Back to Challenges', onClick: () => {} } },
  compiler: { title: 'Compiler not found', description: 'This language route is not available.', kind: 'not-found', primaryAction: { label: 'View compilers', onClick: () => {} } },
  notfound: { title: 'Page not found', description: 'This link is invalid or no longer available.', kind: 'not-found', primaryAction: { label: 'Return home', onClick: () => {} } },
  panel: { title: 'The code workspace could not be displayed.', description: 'Retry the compiler to continue.', variant: 'panel', alert: true, primaryAction: { label: 'Try again', onClick: () => {} } },
};

function Fixture() {
  if (surface === 'landing') return <StandaloneCompilerLanding onNavigate={(path) => { location.hash = path; }} />;
  if (surface === 'certificate') return <CertificateViewer certificate={{ id: 'fixture', credentialId: 'TEST-CREDENTIAL-0001', courseTitle: 'Python Foundations', issueDate: '2026-09-14T00:00:00.000Z', verificationUrl: 'https://example.invalid/verify/test' }} onClose={() => {}} onDownload={() => {}} onShare={() => {}} onCopy={() => {}} />;
  return <main className="visual-error-fixture"><ErrorState {...(cases[surface] ?? cases.notfound)} /></main>;
}

createRoot(document.getElementById('root')).render(<Fixture />);
