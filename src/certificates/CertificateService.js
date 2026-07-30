import { mockCertificates } from './certificateData';
import { createCertificate } from './certificateModel';
import { createLocalCertificateRepository } from './localCertificateRepository';

export class CertificateService {
  constructor({ repository = createLocalCertificateRepository() } = {}) {
    this.repository = repository;
  }

  async getCertificates(userId) {
    const stored = await this.repository.load(userId);
    if (stored) return stored.map(createCertificate);
    const initial = mockCertificates.map(createCertificate);
    await this.repository.save(userId, initial);
    return initial;
  }

  async getCertificate(userId, certificateId) {
    const certificates = await this.getCertificates(userId);
    return certificates.find(({ id }) => id === certificateId) ?? null;
  }

  async saveCertificates(userId, certificates) {
    return this.repository.save(userId, certificates.map(createCertificate));
  }

  async resetCertificates(userId) {
    await this.repository.clear(userId);
    return this.getCertificates(userId);
  }

  exportCertificate(certificate) {
    return JSON.stringify({
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      certificate,
    }, null, 2);
  }
}

export const certificateService = new CertificateService();
