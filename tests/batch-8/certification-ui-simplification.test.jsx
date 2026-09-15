import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const examState = vi.hoisted(() => ({ value: null }));
const certificateState = vi.hoisted(() => ({ records: [], getCertificates: vi.fn(), exportCertificate: vi.fn() }));
vi.mock('../../src/exam/hooks/useExam', () => ({ useExam: () => examState.value }));
vi.mock('../../src/auth/UserContext', () => ({ useUser: () => ({ user: { id: 'learner-1' } }) }));
vi.mock('../../src/certificates/CertificateService', () => ({
  certificateService: {
    getCertificates: certificateState.getCertificates,
    exportCertificate: certificateState.exportCertificate,
  },
}));

import { ExamResultPage } from '../../src/exam/pages/ExamResultPage';
import { CertificatesPage } from '../../src/certificates/CertificatesPage';
import { PublicCertificateVerificationPage } from '../../src/certificates/PublicCertificateVerificationPage';
import { publicVerificationUrl } from '../../src/certificates/publicCertificateVerification';

const credentialId = 'MIT-PYTHON-0123456789ABCDEF';
const certificate = { id: credentialId, credentialId, courseId: 'python', courseTitle: 'Python Foundations', status: 'earned', issueDate: '2026-09-14T00:00:00.000Z' };

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
    expect(await screen.findByRole('heading', { name: 'My Certificates' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Test My Setup' })).toBeInTheDocument();
    expect(screen.getByText('Python Foundations')).toBeInTheDocument();
    for (const removed of ['Certificates Earned', 'Courses in Progress', 'In Progress', 'Verification', 'Completed Certificates']) expect(screen.queryByText(removed)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`http://localhost:3000/verify/${credentialId}`));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(credentialId);
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download Certificate' }));
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it('renders the honest certificate empty state', async () => {
    certificateState.records = [];
    render(<CertificatesPage onTestSetup={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'No certificates yet' })).toBeInTheDocument();
  });

  it('previews a clearly non-authoritative sample through the shared certificate viewer', async () => {
    certificateState.records = [];
    render(<CertificatesPage onTestSetup={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'View Example' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Example' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Certificate Example');
    expect(dialog).toHaveTextContent('SAMPLE');
    expect(within(dialog).getByRole('heading', { level: 3, name: 'ycoders' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Python Foundations');
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
