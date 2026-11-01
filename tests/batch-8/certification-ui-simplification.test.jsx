import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const examState = vi.hoisted(() => ({ value: null }));
const certificateState = vi.hoisted(() => ({ records: [], getCertificates: vi.fn(), exportCertificate: vi.fn() }));
vi.mock('../../src/exam/hooks/useExam', () => ({ useExam: () => examState.value }));
vi.mock('../../src/auth/UserContext', () => ({ useUser: () => ({ user: { id: 'learner-1', name: 'Avinash Kumar' } }) }));
vi.mock('../../src/certificates/CertificateService', () => ({
  certificateService: {
    getCertificates: certificateState.getCertificates,
    exportCertificate: certificateState.exportCertificate,
  },
}));

import { ExamResultPage } from '../../src/exam/pages/ExamResultPage';
import { CertificatesPage } from '../../src/certificates/CertificatesPage';
import { CertificateArtifact } from '../../src/certificates/CertificateArtifact';
import { PublicCertificateVerificationPage } from '../../src/certificates/PublicCertificateVerificationPage';
import { publicVerificationUrl } from '../../src/certificates/publicCertificateVerification';

const credentialId = 'MIT-PYTHON-0123456789ABCDEF';
const certificate = { id: credentialId, credentialId, courseId: 'python', courseTitle: 'Python Foundations', status: 'earned', issueDate: '2026-09-14T00:00:00.000Z', verificationStatus: 'verified' };

describe('certification learner UI simplification', () => {
  beforeEach(() => {
    examState.value = { exam: { title: 'Python Foundations Certification' }, result: { certificateId: credentialId, score: 90, integrityReport: { overallStatus: 'CLEAN', detectorSummary: [] }, certificationDecision: { status: 'CERTIFIED', explanation: { statements: ['private explanation'] } } }, resetExam: vi.fn() };
    certificateState.records = [certificate];
    certificateState.getCertificates.mockReset().mockImplementation(async () => certificateState.records);
    certificateState.exportCertificate.mockReset().mockReturnValue('{"canonical":true}');
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => {}) } });
    URL.createObjectURL = vi.fn(() => 'blob:certificate'); URL.revokeObjectURL = vi.fn();
  });
  afterEach(cleanup);

  it('renders only the minimal successful result and opens the canonical credential', () => {
    const onViewCertificate = vi.fn(); const onExit = vi.fn();
    render(<ExamResultPage onExit={onExit} onViewCertificate={onViewCertificate} />);
    expect(screen.getByRole('heading', { name: 'Certified' })).toBeInTheDocument();
    expect(screen.getByText('Congratulations! Your ycoders certification has been issued.')).toBeInTheDocument();
    for (const removed of ['Exam score', 'Integrity status', 'Attempt duration', 'Decision explanation', 'Monitored exam conditions', 'Start another attempt']) expect(screen.queryByText(removed)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Certificate' }));
    expect(onViewCertificate).toHaveBeenCalledWith(credentialId);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Certificates' })); expect(onExit).toHaveBeenCalledOnce();
  });

  it('keeps a truthful non-certified result and legitimate retry', () => {
    examState.value = { ...examState.value, result: { ...examState.value.result, certificateId: null, certificationDecision: { status: 'NOT_CERTIFIED' } } };
    render(<ExamResultPage onExit={vi.fn()} onViewCertificate={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Certification not passed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start another attempt/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Certificate' })).not.toBeInTheDocument();
  });

  it('keeps only setup and issued certificates and shares a public URL', async () => {
    render(<CertificatesPage onTestSetup={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Certificates' })).toBeInTheDocument();
    expect(screen.getByText('View and verify your earned certificates.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'My Certificates' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test My Setup' })).toBeInTheDocument();
    expect(screen.getByText('Python Foundations')).toBeInTheDocument();
    for (const removed of ['Certificates Earned', 'Courses in Progress', 'In Progress', 'Verification', 'Completed Certificates']) expect(screen.queryByText(removed)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Certificate' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.querySelector('#certificate-viewer-title')).toHaveTextContent('Python Foundations');
    expect(within(dialog).getByRole('region', { name: 'Certificate preview' })).toBeInTheDocument();
    expect(within(dialog).getByRole('complementary', { name: 'Credential details' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close certificate viewer' })).toBeInTheDocument();
    expect(within(dialog).getAllByText('Credential ID').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(credentialId).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('Avinash Kumar').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('Python Foundations').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('14 September 2026').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('Verified').length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('link', { name: 'Verify Certificate' })).toHaveAttribute('href', `http://localhost:3000/verify/${credentialId}`);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`http://localhost:3000/verify/${credentialId}`));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(credentialId);
    fireEvent.click(screen.getByRole('button', { name: 'Download Certificate' }));
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it('renders the honest certificate empty state', async () => {
    certificateState.records = [];
    render(<CertificatesPage onTestSetup={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'No certificates yet' })).toBeInTheDocument();
    expect(screen.getByText('Complete an eligible certification assessment to earn your first certificate.')).toBeInTheDocument();
  });

  it('previews a clearly non-authoritative sample through the shared certificate viewer', async () => {
    certificateState.records = [];
    render(<CertificatesPage onTestSetup={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'View Example' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Example' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Certificate Example');
    expect(dialog).toHaveTextContent('SAMPLE');
    expect(dialog).toHaveTextContent('Sample Certificate');
    expect(dialog).toHaveTextContent('Not issued');
    expect(dialog).toHaveTextContent('Sample Certificate');
    expect(screen.queryByRole('button', { name: 'Download Certificate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copy/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(certificateState.exportCertificate).not.toHaveBeenCalled();
    expect(certificateState.records).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Close certificate viewer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps long authoritative names and course titles inside the scalable certificate artifact', () => {
    render(<CertificateArtifact certificate={{
      ...certificate,
      recipientName: 'Muhammad Abdul Rahman Khan',
      courseTitle: 'Advanced Object-Oriented Programming and Application Architecture',
    }} />);
    const artifact = screen.getByTestId('certificate-artifact');
    expect(artifact).toHaveAccessibleName(/Muhammad Abdul Rahman Khan.*Advanced Object-Oriented Programming/);
    expect(within(artifact).getByTitle('Muhammad Abdul Rahman Khan')).toBeInTheDocument();
    expect(within(artifact).getByTitle('Advanced Object-Oriented Programming and Application Architecture')).toBeInTheDocument();
  });

  it('stacks the modal layout responsively without fixed certificate dimensions', () => {
    const css = readFileSync('src/styles/pages/certificates.css', 'utf8');
    expect(css).toMatch(/@media \(max-width: 960px\)[\s\S]*\.certificate-viewer-body\s*{\s*grid-template-columns:\s*1fr/);
    expect(css).toContain('aspect-ratio: 1579 / 996');
  });
});

describe('public certificate verification', () => {
  afterEach(cleanup);
  it('uses local origin in development and ycoders.com in production', () => {
    expect(publicVerificationUrl(credentialId, { origin: 'http://127.0.0.1:5173', production: false })).toBe(`http://127.0.0.1:5173/verify/${credentialId}`);
    expect(publicVerificationUrl(credentialId, { origin: 'http://localhost', production: true })).toBe(`https://ycoders.com/verify/${credentialId}`);
  });
  it('shows only the bounded public projection', async () => {
    const verifier = vi.fn(async () => ({ credentialId, courseTitle: 'Python Foundations', recipientName: 'Test Learner', issuedAt: '2026-09-14T00:00:00.000Z', status: 'VERIFIED', email: 'private@example.test', ownerUid: 'private-uid' }));
    render(<PublicCertificateVerificationPage credentialId={credentialId} verifier={verifier} />);
    expect(await screen.findByText('Verified', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Test Learner')).toBeInTheDocument();
    expect(screen.getByText('Python Foundations')).toBeInTheDocument();
    expect(screen.queryByText('private@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('private-uid')).not.toBeInTheDocument();
  });
  it('fails honestly for an unknown credential', async () => {
    render(<PublicCertificateVerificationPage credentialId={credentialId} verifier={async () => ({ status: 'NOT_FOUND' })} />);
    expect(await screen.findByRole('heading', { name: 'Certificate not found' })).toBeInTheDocument();
  });
});
